-- Tracks which generation cycle produced a child recurring invoice.
-- Format: <parent_invoice_id>:<YYYY-MM-DD>  (e.g. "abc123:2026-08-01")
-- The partial unique index means only one child per parent per generation date can exist,
-- so concurrent or retried cron runs are safe to treat as already-done on conflict.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS recurring_generation_key text;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_recurring_generation_key_idx
  ON public.invoices (user_id, recurring_generation_key)
  WHERE recurring_generation_key IS NOT NULL;
