-- Atomic invoice view recorder.
-- Increments view_count by 1 in a single UPDATE statement and returns
-- whether this was the first view (new count = 1).  Because PostgreSQL
-- locks the row during the UPDATE, two concurrent requests both
-- incrementing from 0 will resolve sequentially: one returns true
-- (first view, sends the notification email) and the other returns false.
CREATE OR REPLACE FUNCTION record_invoice_view(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count integer;
BEGIN
  UPDATE invoices
  SET
    view_count = COALESCE(view_count, 0) + 1,
    viewed_at  = now()
  WHERE share_token = p_token
  RETURNING view_count INTO v_new_count;

  -- new count = 1 means old count was 0 → genuine first view
  RETURN COALESCE(v_new_count, 0) = 1;
END;
$$;
