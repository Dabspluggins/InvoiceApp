-- RPC: reject_estimate_negotiation
-- Wraps the three core rejection mutations in a single transaction so the
-- estimate cannot be left in a half-rejected state if any step fails.
-- Ownership is validated via auth.uid() — callers cannot spoof another user.
-- Called by: src/app/api/estimates/[id]/reject-negotiation/route.ts

CREATE OR REPLACE FUNCTION public.reject_estimate_negotiation(
  p_estimate_id  uuid,
  p_note         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_estimate      record;
  v_subtotal      numeric(12,2);
  v_discount_amt  numeric(12,2);
  v_taxable       numeric(12,2);
  v_tax_amt       numeric(12,2);
  v_total         numeric(12,2);
BEGIN
  -- 1. Fetch and lock the estimate row — FOR UPDATE prevents concurrent reject calls
  --    from both seeing 'revised' and both proceeding.
  SELECT * INTO v_estimate
  FROM public.estimates
  WHERE id = p_estimate_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_estimate.status <> 'revised' THEN
    RETURN jsonb_build_object('error', 'not_revised');
  END IF;

  -- 2. Restore all client-deleted items and clear proposed prices
  UPDATE public.estimate_line_items
  SET client_proposed_price = NULL,
      deleted_by_client = FALSE
  WHERE estimate_id = p_estimate_id;

  -- 3. Recalculate totals from original unit prices
  SELECT COALESCE(SUM(unit_price * quantity), 0)
  INTO v_subtotal
  FROM public.estimate_line_items
  WHERE estimate_id = p_estimate_id;

  IF v_estimate.discount_type = 'percentage' THEN
    v_discount_amt := v_subtotal * (COALESCE(v_estimate.discount_value, 0) / 100.0);
  ELSE
    v_discount_amt := COALESCE(v_estimate.discount_value, 0);
  END IF;

  -- Clamp so fixed discounts larger than subtotal do not produce a negative tax base
  v_taxable  := GREATEST(0, v_subtotal - v_discount_amt);
  v_tax_amt  := v_taxable * (COALESCE(v_estimate.tax_rate, 0) / 100.0);
  v_total    := v_taxable + v_tax_amt;

  -- 4. Update estimate status and recalculated totals atomically
  UPDATE public.estimates
  SET status          = 'sent',
      subtotal        = v_subtotal,
      discount_amount = v_discount_amt,
      tax_amount      = v_tax_amt,
      total           = v_total,
      updated_at      = NOW()
  WHERE id = p_estimate_id;

  -- 5. Log the rejection event (best-effort inside the same transaction)
  INSERT INTO public.estimate_events (estimate_id, event_type, actor, details)
  VALUES (
    p_estimate_id,
    'negotiation_rejected',
    'owner',
    CASE WHEN p_note IS NOT NULL THEN jsonb_build_object('note', p_note) ELSE NULL END
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Restrict execution to authenticated users only
REVOKE ALL ON FUNCTION public.reject_estimate_negotiation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_estimate_negotiation(uuid, text) TO authenticated;
