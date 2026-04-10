-- Run this migration in the Supabase SQL editor to add portal tokens to clients:
--
-- ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;
-- UPDATE clients SET portal_token = substr(md5(random()::text), 1, 16) WHERE portal_token IS NULL;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  invoice_number text not null,
  status text not null default 'draft',
  issue_date date not null,
  due_date date,
  currency text not null default 'USD',
  business_name text, business_address text, business_email text, business_phone text, logo_url text,
  client_name text, client_company text, client_address text, client_email text,
  subtotal numeric(12,2) default 0, tax_rate numeric(5,2) default 0, tax_amount numeric(12,2) default 0, total numeric(12,2) default 0,
  notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  description text, quantity numeric(10,2) default 1, rate numeric(12,2) default 0, amount numeric(12,2) default 0, sort_order int default 0
);

alter table invoices enable row level security;
alter table line_items enable row level security;
create policy "Users own invoices" on invoices for all using (auth.uid() = user_id);
create policy "Users own line items" on line_items for all using (invoice_id in (select id from invoices where user_id = auth.uid()));
