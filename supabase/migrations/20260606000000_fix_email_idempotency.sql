-- =============================================================
-- Fix 1a: Create missing profile rows for existing auth.users
-- =============================================================
-- Users who signed up before profile rows were created have no row.
-- The welcome email guard in /api/welcome-email would treat a missing
-- row as "send eligible". Pre-create those rows with welcome_sent = true
-- so they are never flagged as new signups.
INSERT INTO public.profiles (id, welcome_sent)
SELECT au.id, true
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- Fix 1b: Mark all existing profile rows as welcome_sent = true
-- =============================================================
-- These users signed up before the welcome_sent column was introduced.
-- The column was added with DEFAULT false, so existing rows got false,
-- not true. Any dashboard visit would re-trigger the welcome email.
UPDATE public.profiles
SET welcome_sent = true
WHERE welcome_sent = false
   OR welcome_sent IS NULL;

-- =============================================================
-- Fix 2: Invoice view_count backfill
-- =============================================================
-- Invoices that have viewed_at set but view_count = 0 or NULL were opened
-- before the record_invoice_view RPC was deployed (May 7 2026). The
-- view_count column was added with DEFAULT 0, so those rows landed at 0
-- rather than reflecting their real view history. Any subsequent page load
-- would see COALESCE(0, 0) + 1 = 1 and re-fire the "first view" email.
-- Setting view_count = 1 marks them as already notified.
UPDATE public.invoices
SET view_count = 1
WHERE viewed_at IS NOT NULL
  AND COALESCE(view_count, 0) = 0;

-- =============================================================
-- Fix 3: Replace record_invoice_view RPC with dual-gate version
-- =============================================================
-- The old RPC returned true whenever view_count went from 0 to 1,
-- ignoring viewed_at. The new version captures pre-update state atomically
-- (row-locked SELECT FOR UPDATE) and only returns true when BOTH:
--   • viewed_at was NULL (never recorded a view before), AND
--   • view_count was 0 or NULL
-- This makes the notification immune to view_count drift.
CREATE OR REPLACE FUNCTION record_invoice_view(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_first boolean;
BEGIN
  -- Lock the row and capture whether this is genuinely a first view.
  -- FOR UPDATE prevents concurrent calls from both seeing the pre-update state.
  SELECT (viewed_at IS NULL AND COALESCE(view_count, 0) = 0)
    INTO v_was_first
    FROM invoices
   WHERE share_token = p_token
     FOR UPDATE;

  -- Token doesn't match any invoice
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Always increment and timestamp (even for repeat views)
  UPDATE invoices
     SET view_count = COALESCE(view_count, 0) + 1,
         viewed_at  = now()
   WHERE share_token = p_token;

  -- Fire notification only on the genuine first human view
  RETURN COALESCE(v_was_first, false);
END;
$$;
