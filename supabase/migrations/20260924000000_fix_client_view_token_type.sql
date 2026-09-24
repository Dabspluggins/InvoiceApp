-- Fix record_estimate_client_view: compare uuid to uuid.
--
-- Symptom: every call failed in production with
--   42883: operator does not exist: uuid = text
-- so the "your client opened this estimate" email never sent. The public page
-- and the approve/revise endpoint were unaffected — they query through
-- PostgREST, which coerces text to uuid. Only this plpgsql function is strict.
--
-- Cause: estimates.client_token is uuid in production. The migration that
-- appears to define it uses CREATE TABLE IF NOT EXISTS against a table that
-- already existed, so its column list never ran. See the companion migration
-- 20260924000001_reconcile_schema_drift.sql.
--
-- CREATE OR REPLACE preserves existing privileges, so the service_role-only
-- lockdown from 20260921000000 stays in force. No application deploy needed:
-- the route already passes the token as text.

CREATE OR REPLACE FUNCTION record_estimate_client_view(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token       uuid;
  v_estimate_id uuid;
  v_inserted_id uuid;
BEGIN
  -- estimates.client_token is uuid in production, not text as
  -- 20260428000000_stabilize_core_schema.sql declares. PostgREST coerces the
  -- two, so the page and the action endpoint were unaffected, but plpgsql is
  -- strict and this comparison raised 42883 on every call. Cast once, and
  -- treat a malformed token as "not found" rather than an error, so a junk
  -- URL returns false instead of throwing.
  BEGIN
    v_token := p_token::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  SELECT id INTO v_estimate_id
  FROM estimates
  WHERE client_token = v_token;

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
