-- Reconcile the migration history with what production actually is.
--
-- 20260428000000_stabilize_core_schema.sql declares its tables with
-- CREATE TABLE IF NOT EXISTS. `estimates` already existed when it ran, so that
-- table's entire column list was silently skipped and the file has described a
-- table that was never created that way ever since. The other tables in that
-- file were genuinely created by it and match.
--
-- A column-by-column diff of production against every migration on disk
-- (clients, estimates, estimate_line_items, estimate_events, invoices — 97
-- columns) found exactly three discrepancies. Two are fixed here.
--
-- The third is clients.updated_at: declared by the stabilize file, absent from
-- production, and verified unused — no TypeScript reads or writes it, no RPC
-- or trigger touches it, and no SQL anywhere updates the clients table.
-- Deliberately NOT dropped. Carrying a DROP COLUMN in migration history
-- forever, so a rebuilt database avoids one unused column, is a worse trade
-- than the cosmetic difference. A database built from this history will have
-- the column; production will not; nothing reads it either way.
--
-- PRODUCTION IS THE SOURCE OF TRUTH. Nothing below changes production: every
-- statement is a no-op against the live database. What they do is make a
-- database built from this migration history end up in the same shape as
-- production, which is not currently true.

-- ── 1. estimates.client_token is uuid, not text ─────────────────────────────
-- Production generates uuids and always has. The stabilize file claims
-- `text unique default encode(gen_random_bytes(16),'hex')`, which never ran.
-- uuid is the better type here — 122 bits of entropy, native indexing — so
-- production keeps it and the history converges to match.
--
-- Guarded: runs only where the column is still text, i.e. a freshly built
-- database. Skipped entirely in production.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'estimates'
      AND column_name  = 'client_token'
      AND data_type    = 'text'
  ) THEN
    ALTER TABLE public.estimates ALTER COLUMN client_token DROP DEFAULT;
    ALTER TABLE public.estimates
      ALTER COLUMN client_token TYPE uuid USING client_token::uuid;
    ALTER TABLE public.estimates
      ALTER COLUMN client_token SET DEFAULT gen_random_uuid();
    RAISE NOTICE 'estimates.client_token converted text -> uuid';
  ELSE
    RAISE NOTICE 'estimates.client_token already uuid — nothing to do';
  END IF;
END $$;

-- ── 2. estimate_line_items.created_at exists in production ──────────────────
-- Present in the live database, created by no migration on disk. Adding it to
-- the history so a rebuilt database has it too.
ALTER TABLE public.estimate_line_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
