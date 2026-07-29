-- Add a preferred currency to clients so the credit ledger can be
-- scoped to a single currency per client.
-- DEFAULT 'NGN' backfills all existing rows automatically.
alter table public.clients
  add column if not exists currency text not null default 'NGN';
