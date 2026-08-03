-- Preflight data audit: fails loudly if existing data would violate the constraints
-- added in migration 0004. Run this before applying the lockdown migration.
-- Supabase applies migrations in filename order, so this runs before 0004.
DO $$
DECLARE
  v_null_user_id      integer;
  v_dup_inv_number    integer;
  v_dup_gen_key       integer;
  v_missing_conv_inv  integer;
BEGIN
  -- 1. Invoices with NULL user_id — migration 0004 will set NOT NULL.
  SELECT COUNT(*)::integer INTO v_null_user_id
    FROM public.invoices
   WHERE user_id IS NULL;
  IF v_null_user_id > 0 THEN
    RAISE EXCEPTION
      'PREFLIGHT FAILED: % invoice(s) have NULL user_id. '
      'Fix those rows before re-running this migration.',
      v_null_user_id;
  END IF;

  -- 2. Duplicate (user_id, invoice_number) pairs — migration 0004 adds a unique index.
  SELECT COUNT(*)::integer INTO v_dup_inv_number
    FROM (
      SELECT user_id, invoice_number
        FROM public.invoices
       GROUP BY user_id, invoice_number
      HAVING COUNT(*) > 1
    ) dupes;
  IF v_dup_inv_number > 0 THEN
    RAISE EXCEPTION
      'PREFLIGHT FAILED: % duplicate (user_id, invoice_number) pair(s) exist. '
      'Deduplicate before re-running this migration.',
      v_dup_inv_number;
  END IF;

  -- 3. Duplicate recurring_generation_key per user — migration 0001 adds a unique index.
  --    Checked here in case data was inserted before that migration ran.
  SELECT COUNT(*)::integer INTO v_dup_gen_key
    FROM (
      SELECT user_id, recurring_generation_key
        FROM public.invoices
       WHERE recurring_generation_key IS NOT NULL
       GROUP BY user_id, recurring_generation_key
      HAVING COUNT(*) > 1
    ) dupes;
  IF v_dup_gen_key > 0 THEN
    RAISE EXCEPTION
      'PREFLIGHT FAILED: % duplicate (user_id, recurring_generation_key) pair(s) exist. '
      'Deduplicate before re-running this migration.',
      v_dup_gen_key;
  END IF;

  -- 4. Estimates marked converted but missing converted_invoice_id.
  --    Migration 0000 adds that column; a missing link means conversion was only
  --    partially applied (e.g., the estimate status was flipped but the FK was not set).
  SELECT COUNT(*)::integer INTO v_missing_conv_inv
    FROM public.estimates
   WHERE status = 'converted'
     AND converted_invoice_id IS NULL;
  IF v_missing_conv_inv > 0 THEN
    RAISE EXCEPTION
      'PREFLIGHT FAILED: % estimate(s) are marked converted but have no converted_invoice_id. '
      'Fix those rows before re-running this migration.',
      v_missing_conv_inv;
  END IF;

  RAISE NOTICE 'PREFLIGHT PASSED: all data integrity checks succeeded.';
END;
$$;
