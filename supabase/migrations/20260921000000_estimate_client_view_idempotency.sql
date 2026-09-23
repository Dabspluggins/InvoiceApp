-- Atomic "client opened this estimate" recorder.
--
-- The route previously did SELECT-then-INSERT to decide whether a view was the
-- first one. Two tabs (or a double-mounted effect) could both pass the SELECT
-- and both insert, sending the owner duplicate "your client opened it" emails.
--
-- Fixed the same way record_invoice_view() handles invoices: let the database
-- decide. A partial unique index makes a second client_viewed row impossible,
-- and ON CONFLICT DO NOTHING turns the race into exactly one winner — the
-- caller that gets a row back is the one that sends the notification.

-- ── 1. Collapse any pre-existing duplicates, keeping the earliest ────────────
-- Must run before the unique index, or index creation fails on existing data.
DELETE FROM public.estimate_events a
USING public.estimate_events b
WHERE a.event_type = 'client_viewed'
  AND b.event_type = 'client_viewed'
  AND a.estimate_id = b.estimate_id
  AND (a.created_at > b.created_at
       OR (a.created_at = b.created_at AND a.id > b.id));

-- ── 2. One client_viewed row per estimate, enforced by the database ─────────
CREATE UNIQUE INDEX IF NOT EXISTS estimate_events_one_client_view_idx
  ON public.estimate_events (estimate_id)
  WHERE event_type = 'client_viewed';

-- ── 3. Record the view and report whether this caller was first ─────────────
-- Returns true at most once per estimate, for the whole lifetime of the row.
-- Returns false for an unknown token, so it is also a token check.
CREATE OR REPLACE FUNCTION record_estimate_client_view(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estimate_id uuid;
  v_inserted_id uuid;
BEGIN
  SELECT id INTO v_estimate_id
  FROM estimates
  WHERE client_token = p_token;

  IF v_estimate_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO estimate_events (estimate_id, event_type, actor, details)
  VALUES (
    v_estimate_id,
    'client_viewed',
    'client',
    jsonb_build_object('at', now())
  )
  ON CONFLICT (estimate_id) WHERE event_type = 'client_viewed'
  DO NOTHING
  RETURNING id INTO v_inserted_id;

  -- Lost the race (or already viewed) — caller must not notify.
  IF v_inserted_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE estimates
  SET status = 'client_reviewing', updated_at = now()
  WHERE id = v_estimate_id
    AND status = 'sent';

  RETURN true;
END;
$$;

-- ── 4. Lock the function down ───────────────────────────────────────────────
-- PostgreSQL grants EXECUTE to PUBLIC by default, and this function is
-- SECURITY DEFINER. Left open, anyone holding a share token could call it
-- straight through PostgREST, burn the single client_viewed row, and the
-- owner's "your client opened this" email would never be sent — the route
-- that sends it only fires when the RPC reports the first view.
-- Only the server-side service role has any business calling this.
REVOKE ALL ON FUNCTION public.record_estimate_client_view(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_estimate_client_view(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_estimate_client_view(text) TO service_role;
