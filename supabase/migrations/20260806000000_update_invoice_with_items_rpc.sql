-- ============================================================
-- Migration: update_invoice_with_items RPC
-- ============================================================
-- Atomically updates the invoice record and replaces all line
-- items in a single transaction.
--
-- Replaces the two-step client-side flow on the UPDATE path:
--   1. supabase.from('invoices').update(...)
--   2. supabase.from('line_items').delete()  ← then →
--   3. supabase.from('line_items').insert(...)
--
-- Any failure rolls back completely — no orphaned invoice with
-- wiped line items if the re-insert step fails.
--
-- Called by: PATCH /api/invoices/[id] (server route, after validation)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_invoice_with_items(
  p_user_id      uuid,
  p_invoice_id   uuid,
  p_invoice_data jsonb,
  p_line_items   jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER functions bypass table RLS, so enforce caller ownership here.
  IF COALESCE(auth.role(), '') <> 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- 1. Verify ownership — raise if invoice doesn't exist or belongs to another user
  IF NOT EXISTS (
    SELECT 1 FROM public.invoices
    WHERE id = p_invoice_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Invoice not found or access denied' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Verify client ownership if client_id is supplied
  -- SECURITY DEFINER bypasses RLS, so we enforce caller ownership explicitly.
  -- Matches the check on the CREATE path (POST /api/invoices route + create RPC).
  IF p_invoice_data->>'client_id' IS NOT NULL AND p_invoice_data->>'client_id' <> '' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = (p_invoice_data->>'client_id')::uuid
        AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Client not found or access denied' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- 3. Update the invoice record (all mutable fields; invoice_number / share_token are immutable)
  UPDATE public.invoices SET
    status              = COALESCE(p_invoice_data->>'status',        'draft'),
    issue_date          = (p_invoice_data->>'issue_date')::date,
    due_date            = (p_invoice_data->>'due_date')::date,
    currency            = p_invoice_data->>'currency',
    discount_type       = COALESCE(p_invoice_data->>'discount_type', 'fixed'),
    subtotal            = COALESCE((p_invoice_data->>'subtotal')::numeric,        0),
    discount            = COALESCE((p_invoice_data->>'discount')::numeric,        0),
    discount_amount     = COALESCE((p_invoice_data->>'discount_amount')::numeric, 0),
    tax_rate            = COALESCE((p_invoice_data->>'tax_rate')::numeric,        0),
    tax_amount          = COALESCE((p_invoice_data->>'tax_amount')::numeric,      0),
    total               = COALESCE((p_invoice_data->>'total')::numeric,           0),
    is_recurring        = COALESCE((p_invoice_data->>'is_recurring')::boolean,    false),
    recurring_frequency = p_invoice_data->>'recurring_frequency',
    recurring_next_date = (p_invoice_data->>'recurring_next_date')::date,
    client_id           = NULLIF(p_invoice_data->>'client_id', '')::uuid,
    business_name       = p_invoice_data->>'business_name',
    business_address    = p_invoice_data->>'business_address',
    business_email      = p_invoice_data->>'business_email',
    business_phone      = p_invoice_data->>'business_phone',
    logo_url            = p_invoice_data->>'logo_url',
    client_name         = p_invoice_data->>'client_name',
    client_company      = p_invoice_data->>'client_company',
    client_address      = p_invoice_data->>'client_address',
    client_email        = p_invoice_data->>'client_email',
    notes               = p_invoice_data->>'notes',
    brand_color         = p_invoice_data->>'brand_color',
    payment_details     = p_invoice_data->'payment_details',   -- JSONB column: use -> not ->>
    template            = COALESCE(p_invoice_data->>'template', 'classic'),
    language            = COALESCE(p_invoice_data->>'language', 'en'),
    updated_at          = now()
  WHERE id = p_invoice_id;

  -- 4. Delete all existing line items for this invoice
  DELETE FROM public.line_items WHERE invoice_id = p_invoice_id;

  -- 5. Insert the new line items (skip if array is empty)
  IF jsonb_array_length(COALESCE(p_line_items, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.line_items (
      invoice_id,
      description,
      quantity,
      rate,
      amount,
      sort_order,
      stockbook_product_id
    )
    SELECT
      p_invoice_id,
      COALESCE(item->>'description', ''),
      COALESCE((item->>'quantity')::numeric, 1),
      COALESCE((item->>'rate')::numeric,     0),
      COALESCE((item->>'amount')::numeric,   0),
      COALESCE((item->>'sort_order')::int,   0),
      CASE
        WHEN item->>'stockbook_product_id' IS NULL
          OR item->>'stockbook_product_id' = ''
        THEN NULL
        ELSE (item->>'stockbook_product_id')::uuid
      END
    FROM jsonb_array_elements(p_line_items) AS item;
  END IF;

  RETURN jsonb_build_object('invoice_id', p_invoice_id);
END;
$$;

REVOKE ALL ON FUNCTION public.update_invoice_with_items(uuid, uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_invoice_with_items(uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_with_items(uuid, uuid, jsonb, jsonb) TO service_role;
