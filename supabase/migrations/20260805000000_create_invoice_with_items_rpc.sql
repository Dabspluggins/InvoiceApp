-- ============================================================
-- Migration: create_invoice_with_items RPC
-- ============================================================
-- Atomically allocates an invoice number, inserts the invoice,
-- and inserts all line items in a single transaction.
--
-- Replaces the two-step client-side flow:
--   1. POST /api/invoices  (allocate number + insert invoice)
--   2. supabase.from('line_items').insert(...)
--
-- Any failure rolls back completely — no ghost invoices, no
-- wasted sequence numbers.
--
-- Called by: POST /api/invoices (server route, after validation)
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
  p_user_id        uuid,
  p_invoice_data   jsonb,
  p_line_items     jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_number text;
  v_invoice_id     uuid;
  v_client_id      uuid;
BEGIN
  -- SECURITY DEFINER functions bypass table RLS, so enforce caller ownership here.
  IF COALESCE(auth.role(), '') <> 'service_role' AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  v_client_id := NULLIF(p_invoice_data->>'client_id', '')::uuid;

  IF v_client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.clients
    WHERE id = v_client_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'client_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Allocate invoice number from the user's sequence (non-peek → advances counter)
  SELECT next_invoice_number(p_user_id, 'INV-', false)
  INTO   v_invoice_number;

  -- 2. Insert the invoice record
  INSERT INTO public.invoices (
    user_id,
    invoice_number,
    share_token,
    status,
    issue_date,
    due_date,
    currency,
    discount_type,
    subtotal,
    discount,
    discount_amount,
    tax_rate,
    tax_amount,
    total,
    is_recurring,
    recurring_frequency,
    recurring_next_date,
    client_id,
    business_name,
    business_address,
    business_email,
    business_phone,
    logo_url,
    client_name,
    client_company,
    client_address,
    client_email,
    notes,
    brand_color,
    payment_details,
    template,
    language
  )
  VALUES (
    p_user_id,
    v_invoice_number,
    p_invoice_data->>'share_token',
    COALESCE(p_invoice_data->>'status', 'draft'),
    (p_invoice_data->>'issue_date')::date,
    (p_invoice_data->>'due_date')::date,
    p_invoice_data->>'currency',
    COALESCE(p_invoice_data->>'discount_type', 'fixed'),
    COALESCE((p_invoice_data->>'subtotal')::numeric,       0),
    COALESCE((p_invoice_data->>'discount')::numeric,       0),
    COALESCE((p_invoice_data->>'discount_amount')::numeric,0),
    COALESCE((p_invoice_data->>'tax_rate')::numeric,       0),
    COALESCE((p_invoice_data->>'tax_amount')::numeric,     0),
    COALESCE((p_invoice_data->>'total')::numeric,          0),
    COALESCE((p_invoice_data->>'is_recurring')::boolean,   false),
    p_invoice_data->>'recurring_frequency',
    (p_invoice_data->>'recurring_next_date')::date,
    v_client_id,
    p_invoice_data->>'business_name',
    p_invoice_data->>'business_address',
    p_invoice_data->>'business_email',
    p_invoice_data->>'business_phone',
    p_invoice_data->>'logo_url',
    p_invoice_data->>'client_name',
    p_invoice_data->>'client_company',
    p_invoice_data->>'client_address',
    p_invoice_data->>'client_email',
    p_invoice_data->>'notes',
    p_invoice_data->>'brand_color',
    p_invoice_data->'payment_details',          -- JSONB column: use -> not ->>
    COALESCE(p_invoice_data->>'template', 'classic'),
    COALESCE(p_invoice_data->>'language', 'en')
  )
  RETURNING id INTO v_invoice_id;

  -- 3. Insert line items (skip if array is empty)
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
      v_invoice_id,
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

  RETURN jsonb_build_object(
    'invoice_id',     v_invoice_id,
    'invoice_number', v_invoice_number,
    'share_token',    p_invoice_data->>'share_token'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_invoice_with_items(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invoice_with_items(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_with_items(uuid, jsonb, jsonb) TO service_role;
