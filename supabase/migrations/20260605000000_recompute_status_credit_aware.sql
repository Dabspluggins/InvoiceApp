-- Fix recompute_invoice_status to include credit_applied in the effective amount paid.
-- Previously the function only summed payments.amount and compared against invoice.total,
-- which caused invoices with applied credit to stay as 'partial' even when the remaining
-- balance was fully settled (e.g. total=100, credit_applied=20, payments=80 → should be 'paid').

CREATE OR REPLACE FUNCTION recompute_invoice_status(p_invoice_id UUID)
RETURNS TABLE(new_status TEXT, total_paid NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total         NUMERIC;
  v_credit        NUMERIC;
  v_current       TEXT;
  v_paid          NUMERIC;
  v_effective     NUMERIC;
  v_status        TEXT;
  v_owner         UUID;
BEGIN
  -- Ownership check: caller must own the invoice
  SELECT user_id INTO v_owner FROM public.invoices WHERE id = p_invoice_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Lock the invoice row so concurrent calls queue up
  SELECT total, COALESCE(credit_applied, 0), status
    INTO v_total, v_credit, v_current
    FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;

  -- Sum all payments recorded in the ledger
  SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM public.payments WHERE invoice_id = p_invoice_id;

  -- Effective amount settled = cash payments + credit already applied to this invoice
  v_effective := v_paid + v_credit;

  -- Determine new status
  v_status := CASE
    WHEN v_effective >= v_total  THEN 'paid'
    WHEN v_effective > 0         THEN 'partial'
    WHEN v_current = 'draft'     THEN 'draft'
    ELSE                              'sent'
  END;

  -- Write atomically in the same transaction
  UPDATE public.invoices SET
    status  = v_status,
    paid_at = CASE WHEN v_status = 'paid' THEN NOW() ELSE NULL END
  WHERE id = p_invoice_id;

  -- Return total_paid as effective amount (cash + credit) for the caller
  RETURN QUERY SELECT v_status, v_effective;
END;
$$;

-- Restrict execution to authenticated role only
REVOKE EXECUTE ON FUNCTION recompute_invoice_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recompute_invoice_status(UUID) TO authenticated;

-- Backfill: fix existing invoices stuck as 'partial' where credit_applied + payments already
-- covers the total. These were left stranded by the old function that ignored credit_applied.
-- Runs as a plain SQL UPDATE so it works during migration without requiring auth.uid().
UPDATE public.invoices i
SET
  status  = 'paid',
  paid_at = COALESCE(i.paid_at, NOW())
WHERE i.status IN ('partial', 'sent', 'pending')
  AND COALESCE(i.credit_applied, 0) > 0
  AND (
    SELECT COALESCE(SUM(p.amount), 0)
      FROM public.payments p
     WHERE p.invoice_id = i.id
  ) + COALESCE(i.credit_applied, 0) >= i.total;
