-- Lock down invoice numbering integrity.
-- Preflight (migration 0003) must have passed before this runs.

-- 1. Enforce non-null user_id on all invoices.
--    Preflight guarantees no existing NULLs, so this is safe to apply.
ALTER TABLE public.invoices
  ALTER COLUMN user_id SET NOT NULL;

-- 2. Unique invoice numbers per user.
--    Prevents the application-level race condition where two concurrent creates
--    could produce duplicate numbers before the sequence RPC is called.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_invoice_number_idx
  ON public.invoices (user_id, invoice_number);

-- 3. Enable RLS on invoice_sequences so row-level policies apply.
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- 4. Revoke direct table access from anon and authenticated.
--    The only supported access path is through next_invoice_number() (SECURITY DEFINER)
--    and the service_role key (used by admin operations and the cron route).
REVOKE ALL ON public.invoice_sequences FROM anon;
REVOKE ALL ON public.invoice_sequences FROM authenticated;
