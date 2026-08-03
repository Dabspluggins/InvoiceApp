-- Atomically generates one recurring child invoice for a given parent.
--
-- Idempotency: if a prior run already inserted a child for this cycle
-- (identified by generation key = parent_id || ':' || scheduled_date), this
-- function advances the parent's next date and returns already_generated = true.
-- This means a retried cron run can never be stuck: if the child exists but the
-- parent was not advanced, the retry finishes the job without creating a duplicate.
--
-- Called by the cron route with service_role. Not exposed to authenticated callers.
CREATE OR REPLACE FUNCTION public.generate_recurring_invoice(
  p_parent_id uuid,
  p_today     date
)
RETURNS TABLE (child_invoice_id uuid, already_generated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent        public.invoices%ROWTYPE;
  v_scheduled     date;
  v_gen_key       text;
  v_existing_id   uuid;
  v_new_number    text;
  v_new_id        uuid;
  v_new_next_date date;
BEGIN
  -- Lock the parent row to prevent concurrent generation for the same parent.
  SELECT * INTO v_parent
    FROM public.invoices
   WHERE id          = p_parent_id
     AND is_recurring = true
     AND status      <> 'cancelled'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent_not_found';
  END IF;

  v_scheduled := v_parent.recurring_next_date;

  -- Guard: only generate if actually due (handles race where two cron runs start).
  IF v_scheduled IS NULL OR v_scheduled > p_today THEN
    RETURN QUERY SELECT NULL::uuid, false;
    RETURN;
  END IF;

  -- Generation key ties this child to the scheduled billing cycle, not the run date.
  -- A child that exists under this key means this cycle was already processed.
  v_gen_key := v_parent.id::text || ':' || v_scheduled::text;

  -- Advance the parent by exactly one period from the scheduled date.
  -- Using scheduled date (not today) keeps billing cycles predictable regardless
  -- of when the cron actually fires.
  v_new_next_date := CASE v_parent.recurring_frequency
    WHEN 'weekly'    THEN v_scheduled + interval '7 days'
    WHEN 'monthly'   THEN v_scheduled + interval '1 month'
    WHEN 'quarterly' THEN v_scheduled + interval '3 months'
    ELSE NULL
  END;

  -- Idempotency check: look for an existing child with the same generation key.
  SELECT id INTO v_existing_id
    FROM public.invoices
   WHERE user_id                = v_parent.user_id
     AND recurring_generation_key = v_gen_key;

  IF FOUND THEN
    -- Child already exists (prior run inserted it).
    -- Advance the parent's next date now in case the prior run crashed before doing so.
    -- The WHERE clause guards against double-advancing if parent was already moved.
    UPDATE public.invoices
       SET recurring_next_date = v_new_next_date
     WHERE id = v_parent.id
       AND recurring_next_date = v_scheduled;

    RETURN QUERY SELECT v_existing_id, true;
    RETURN;
  END IF;

  -- Allocate next invoice number atomically.
  SELECT public.next_invoice_number(v_parent.user_id, 'INV-', false) INTO v_new_number;

  -- Insert child invoice as a copy of the parent for this billing cycle.
  INSERT INTO public.invoices (
    user_id, invoice_number, status,
    issue_date, due_date, currency,
    business_name, business_address, business_email, business_phone,
    logo_url, brand_color,
    client_name, client_company, client_address, client_email,
    subtotal, discount, discount_type, discount_amount,
    tax_rate, tax_amount, total,
    notes, payment_details,
    template, language,
    is_recurring, recurring_frequency, recurring_next_date,
    recurring_parent_id, recurring_generation_key,
    client_id
  )
  VALUES (
    v_parent.user_id, v_new_number, 'draft',
    p_today, v_scheduled, v_parent.currency,
    v_parent.business_name, v_parent.business_address,
    v_parent.business_email, v_parent.business_phone,
    v_parent.logo_url, v_parent.brand_color,
    v_parent.client_name, v_parent.client_company,
    v_parent.client_address, v_parent.client_email,
    v_parent.subtotal, v_parent.discount, v_parent.discount_type, v_parent.discount_amount,
    v_parent.tax_rate, v_parent.tax_amount, v_parent.total,
    v_parent.notes, v_parent.payment_details,
    v_parent.template, v_parent.language,
    false, NULL, NULL,
    v_parent.id, v_gen_key,
    v_parent.client_id
  )
  RETURNING id INTO v_new_id;

  -- Copy line items from parent to child.
  INSERT INTO public.line_items (
    invoice_id, description, quantity, rate, amount, sort_order, stockbook_product_id
  )
  SELECT
    v_new_id, description, quantity, rate, amount, sort_order, stockbook_product_id
  FROM public.line_items
  WHERE invoice_id = v_parent.id;

  -- Advance the parent's next date.
  UPDATE public.invoices
     SET recurring_next_date = v_new_next_date
   WHERE id = v_parent.id;

  RETURN QUERY SELECT v_new_id, false;
END;
$$;

-- Only accessible via service_role (cron route). Not exposed to authenticated callers.
GRANT EXECUTE ON FUNCTION public.generate_recurring_invoice(uuid, date) TO service_role;
REVOKE EXECUTE ON FUNCTION public.generate_recurring_invoice(uuid, date) FROM PUBLIC;
