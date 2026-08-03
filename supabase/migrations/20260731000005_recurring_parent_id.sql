-- Add recurring_parent_id to invoices.
-- Required by the recurring cron route and generate_recurring_invoice RPC (migration 0006).
-- The column was referenced in application code but was never formally added in a migration.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS recurring_parent_id uuid
  REFERENCES public.invoices(id) ON DELETE SET NULL;
