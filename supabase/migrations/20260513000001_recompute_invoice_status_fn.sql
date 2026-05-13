CREATE OR REPLACE FUNCTION recompute_invoice_status(p_invoice_id UUID)
RETURNS TABLE(new_status TEXT, total_paid NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total   NUMERIC;
  v_current TEXT;
  v_paid    NUMERIC;
  v_status  TEXT;
  v_owner   UUID;
BEGIN
  -- Ownership check: caller must own the invoice
  SELECT user_id INTO v_owner FROM public.invoices WHERE id = p_invoice_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Lock the invoice row so concurrent calls queue up
  SELECT total, status INTO v_total, v_current
    FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;

  -- Sum all payments in the same transaction
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments WHERE invoice_id = p_invoice_id;

  -- Determine new status
  v_status := CASE
    WHEN v_paid >= v_total   THEN 'paid'
    WHEN v_paid > 0          THEN 'partial'
    WHEN v_current = 'draft' THEN 'draft'
    ELSE                          'sent'
  END;

  -- Write atomically in the same transaction
  UPDATE public.invoices SET
    status  = v_status,
    paid_at = CASE WHEN v_status = 'paid' THEN NOW() ELSE NULL END
  WHERE id = p_invoice_id;

  RETURN QUERY SELECT v_status, v_paid;
END;
$$;

-- Restrict execution to authenticated role only
REVOKE EXECUTE ON FUNCTION recompute_invoice_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recompute_invoice_status(UUID) TO authenticated;
