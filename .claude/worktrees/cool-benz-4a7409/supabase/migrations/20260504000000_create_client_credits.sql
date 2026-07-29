-- Upgrade client_credits to full credit ledger schema.
-- The table was created in 20260428000000_stabilize_core_schema.sql with a
-- two-type constraint and a differently-named invoice FK column.  This
-- migration brings it into alignment with the full feature spec.

-- 1. Rename the invoice FK column
alter table public.client_credits
  rename column reference_invoice_id to invoice_id;

-- 2. Add the reference_number column used for deposit receipts / cheque nos.
alter table public.client_credits
  add column if not exists reference_number text;

-- 3. Replace the two-value type constraint with the full four-value set.
--    We migrate any existing rows first so the new constraint can be applied.
update public.client_credits set type = 'credit_added'    where type = 'credited';
update public.client_credits set type = 'credit_applied'  where type = 'applied';

alter table public.client_credits
  drop constraint if exists client_credits_type_check;

alter table public.client_credits
  add constraint client_credits_type_check
  check (type in ('credit_added', 'credit_applied', 'credit_refunded', 'credit_adjusted'));

-- 4. Add missing indexes (idempotent)
create index if not exists client_credits_client_id_idx on public.client_credits(client_id);
create index if not exists client_credits_user_id_idx   on public.client_credits(user_id);

-- 5. Track how much credit has been applied on each invoice.
alter table public.invoices
  add column if not exists credit_applied numeric(12,2) not null default 0;
