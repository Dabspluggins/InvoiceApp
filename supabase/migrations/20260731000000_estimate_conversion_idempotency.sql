-- Track which invoice an estimate was converted to.
-- The unique partial index ensures at most one conversion per estimate at DB level.
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS converted_invoice_id uuid REFERENCES public.invoices(id);

CREATE UNIQUE INDEX IF NOT EXISTS estimates_converted_invoice_id_idx
  ON public.estimates (converted_invoice_id)
  WHERE converted_invoice_id IS NOT NULL;

-- RPC: convert an estimate to an invoice in a single atomic transaction.
--
-- This replaces the previous multi-step route approach (create invoice → create
-- line items → call mark_estimate_converted), which left orphan invoices if the
-- route crashed between steps.
--
-- The full sequence runs inside one PL/pgSQL transaction:
--   1. Auth guard
--   2. SELECT estimate FOR UPDATE  (row lock serialises concurrent calls)
--   3. Idempotency check           (already converted → return existing invoice)
--   4. Status validation
--   5. Active line-item check
--   6. Fetch business info from user's most recent invoice
--   7. Fetch client company/address if estimate has a linked client
--   8. Calculate totals
--   9. Allocate invoice number via next_invoice_number()
--  10. Insert invoice
--  11. Insert line items
--  12. Mark estimate converted + set converted_invoice_id
--  13. Log estimate event
--  14. Return (invoice_id, invoice_number, already_converted)
--
-- Caller (route) is responsible for generating share_token and firing QStash
-- after this RPC succeeds.
CREATE OR REPLACE FUNCTION public.convert_estimate_to_invoice(
  p_estimate_id uuid,
  p_user_id     uuid,
  p_share_token text
)
RETURNS TABLE (invoice_id uuid, invoice_number text, already_converted boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_est             public.estimates%ROWTYPE;
  v_biz_name        text;
  v_biz_addr        text;
  v_biz_email       text;
  v_biz_phone       text;
  v_biz_logo        text;
  v_biz_color       text;
  v_client_company  text;
  v_client_address  text;
  v_subtotal        numeric;
  v_discount_amount numeric;
  v_taxable         numeric;
  v_tax_amount      numeric;
  v_total           numeric;
  v_discount_type   text;
  v_inv_number      text;
  v_inv_id          uuid;
  v_existing_number text;
BEGIN
  -- Reject calls where the authenticated JWT user does not match p_user_id.
  -- auth.uid() is NULL for service_role callers, which are allowed through.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Acquire a row-level lock on the estimate. Any concurrent call for the same
  -- estimate blocks here until the first caller commits.
  SELECT * INTO v_est
    FROM public.estimates
   WHERE id = p_estimate_id AND user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'estimate_not_found';
  END IF;

  -- Idempotency: return the existing invoice if already converted.
  IF v_est.converted_invoice_id IS NOT NULL THEN
    SELECT inv.invoice_number INTO v_existing_number
      FROM public.invoices inv
     WHERE inv.id = v_est.converted_invoice_id;
    RETURN QUERY SELECT v_est.converted_invoice_id, v_existing_number, true;
    RETURN;
  END IF;

  -- Validate estimate status.
  IF v_est.status NOT IN ('approved', 'revised') THEN
    RAISE EXCEPTION 'invalid_estimate_status';
  END IF;

  -- Require at least one active (non-deleted) line item.
  IF NOT EXISTS (
    SELECT 1 FROM public.estimate_line_items
     WHERE estimate_id      = p_estimate_id
       AND deleted_by_client = false
  ) THEN
    RAISE EXCEPTION 'no_active_line_items';
  END IF;

  -- Calculate totals from non-deleted line items, preferring client-proposed prices.
  SELECT COALESCE(
    SUM(COALESCE(eli.client_proposed_price, eli.unit_price) * eli.quantity), 0
  ) INTO v_subtotal
  FROM public.estimate_line_items eli
  WHERE eli.estimate_id      = p_estimate_id
    AND eli.deleted_by_client = false;

  v_discount_amount := CASE v_est.discount_type
    WHEN 'percentage' THEN v_subtotal * (v_est.discount_value / 100.0)
    ELSE v_est.discount_value
  END;
  v_taxable     := GREATEST(0, v_subtotal - v_discount_amount);
  v_tax_amount  := v_taxable * (v_est.tax_rate / 100.0);
  v_total       := v_taxable + v_tax_amount;
  -- Invoices use 'percent' where estimates use 'percentage'.
  v_discount_type := CASE v_est.discount_type WHEN 'percentage' THEN 'percent' ELSE 'fixed' END;

  -- Fetch business info from the user's most recent invoice (best-effort; NULLs are fine).
  SELECT business_name, business_address, business_email, business_phone, logo_url, brand_color
    INTO v_biz_name, v_biz_addr, v_biz_email, v_biz_phone, v_biz_logo, v_biz_color
    FROM public.invoices
   WHERE user_id = p_user_id
   ORDER BY created_at DESC
   LIMIT 1;

  -- Fetch client company and address if the estimate has a linked client.
  IF v_est.client_id IS NOT NULL THEN
    SELECT company, address
      INTO v_client_company, v_client_address
      FROM public.clients
     WHERE id      = v_est.client_id
       AND user_id = p_user_id;
  END IF;

  -- Allocate the next invoice number atomically from the sequence table.
  SELECT public.next_invoice_number(p_user_id, 'INV-', false) INTO v_inv_number;

  -- Insert the invoice. All of this is inside the same transaction as the row lock above.
  INSERT INTO public.invoices (
    user_id, invoice_number, status,
    issue_date, due_date, currency,
    business_name, business_address, business_email, business_phone,
    logo_url, brand_color,
    client_name, client_company, client_address, client_email,
    subtotal, discount_type, discount, discount_amount,
    tax_rate, tax_amount, total,
    notes, share_token
  )
  VALUES (
    p_user_id, v_inv_number, 'draft',
    CURRENT_DATE, NULL, v_est.currency,
    v_biz_name, v_biz_addr, v_biz_email, v_biz_phone,
    v_biz_logo, COALESCE(v_biz_color, '#4F46E5'),
    v_est.client_name, v_client_company, v_client_address, v_est.client_email,
    v_subtotal, v_discount_type, v_est.discount_value, v_discount_amount,
    v_est.tax_rate, v_tax_amount, v_total,
    v_est.notes, p_share_token
  )
  RETURNING id INTO v_inv_id;

  -- Insert line items from the estimate (preserving order and resolved prices).
  INSERT INTO public.line_items (invoice_id, description, quantity, rate, amount, sort_order)
  SELECT
    v_inv_id,
    eli.description,
    eli.quantity,
    COALESCE(eli.client_proposed_price, eli.unit_price),
    COALESCE(eli.client_proposed_price, eli.unit_price) * eli.quantity,
    ROW_NUMBER() OVER (ORDER BY eli.sort_order) - 1
  FROM public.estimate_line_items eli
  WHERE eli.estimate_id      = p_estimate_id
    AND eli.deleted_by_client = false
  ORDER BY eli.sort_order;

  -- Mark the estimate as converted and link the new invoice.
  UPDATE public.estimates
     SET converted_invoice_id = v_inv_id,
         status               = 'converted',
         updated_at           = now()
   WHERE id      = p_estimate_id
     AND user_id = p_user_id;

  -- Log the conversion event.
  INSERT INTO public.estimate_events (estimate_id, event_type, actor, details)
  VALUES (
    p_estimate_id, 'converted', 'owner',
    jsonb_build_object('invoice_id', v_inv_id, 'invoice_number', v_inv_number)
  );

  RETURN QUERY SELECT v_inv_id, v_inv_number, false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_estimate_to_invoice(uuid, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.convert_estimate_to_invoice(uuid, uuid, text) FROM PUBLIC;
