-- Stabilization migration for the application tables and columns currently used by the app.
-- This migration is intentionally idempotent so it can be applied to an existing Supabase project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text,
  profile_picture_url text,
  logo_url text,
  brand_color text default '#4F46E5',
  dashboard_theme text default 'indigo',
  dark_mode boolean default false,
  default_tax_rate numeric(5,2) default 0,
  default_notes text,
  default_terms text,
  email_updates boolean default true,
  payment_methods jsonb default '[]'::jsonb,
  welcome_sent boolean default false,
  idle_timeout_minutes integer,
  watermark_enabled boolean default false,
  watermark_opacity integer default 10,
  login_alerts_enabled boolean default true,
  secure_account_token text,
  secure_account_token_expires_at timestamptz,
  revoke_token text,
  revoke_token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists profile_picture_url text;
alter table public.profiles add column if not exists logo_url text;
alter table public.profiles add column if not exists brand_color text default '#4F46E5';
alter table public.profiles add column if not exists dashboard_theme text default 'indigo';
alter table public.profiles add column if not exists dark_mode boolean default false;
alter table public.profiles add column if not exists default_tax_rate numeric(5,2) default 0;
alter table public.profiles add column if not exists default_notes text;
alter table public.profiles add column if not exists default_terms text;
alter table public.profiles add column if not exists email_updates boolean default true;
alter table public.profiles add column if not exists payment_methods jsonb default '[]'::jsonb;
alter table public.profiles add column if not exists welcome_sent boolean default false;
alter table public.profiles add column if not exists idle_timeout_minutes integer;
alter table public.profiles add column if not exists watermark_enabled boolean default false;
alter table public.profiles add column if not exists watermark_opacity integer default 10;
alter table public.profiles add column if not exists login_alerts_enabled boolean default true;
alter table public.profiles add column if not exists secure_account_token text;
alter table public.profiles add column if not exists secure_account_token_expires_at timestamptz;
alter table public.profiles add column if not exists revoke_token text;
alter table public.profiles add column if not exists revoke_token_expires_at timestamptz;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  invoice_number text not null,
  status text not null default 'draft',
  issue_date date not null,
  due_date date,
  currency text not null default 'USD',
  business_name text,
  business_address text,
  business_email text,
  business_phone text,
  logo_url text,
  client_name text,
  client_company text,
  client_address text,
  client_email text,
  subtotal numeric(12,2) default 0,
  tax_rate numeric(5,2) default 0,
  tax_amount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  description text,
  quantity numeric(10,2) default 1,
  rate numeric(12,2) default 0,
  amount numeric(12,2) default 0,
  sort_order int default 0
);

alter table public.invoices add column if not exists discount numeric(12,2) default 0;
alter table public.invoices add column if not exists discount_type text default 'percent';
alter table public.invoices add column if not exists discount_amount numeric(12,2) default 0;
alter table public.invoices add column if not exists brand_color text default '#4F46E5';
alter table public.invoices add column if not exists is_recurring boolean default false;
alter table public.invoices add column if not exists recurring_frequency text;
alter table public.invoices add column if not exists recurring_next_date date;
alter table public.invoices add column if not exists share_token text;
alter table public.invoices add column if not exists payment_details jsonb;
alter table public.invoices add column if not exists template text default 'classic';
alter table public.invoices add column if not exists language text default 'en';
alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists reminders_sent integer default 0;
alter table public.invoices add column if not exists last_reminder_sent_at timestamptz;
alter table public.invoices add column if not exists viewed_at timestamptz;
alter table public.invoices add column if not exists view_count integer default 0;

create unique index if not exists invoices_share_token_idx on public.invoices(share_token) where share_token is not null;
create index if not exists invoices_user_created_idx on public.invoices(user_id, created_at desc);
create index if not exists line_items_invoice_sort_idx on public.line_items(invoice_id, sort_order);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at date not null,
  note text,
  created_at timestamptz default now()
);

create index if not exists payments_invoice_id_idx on public.payments(invoice_id);
create index if not exists payments_user_id_idx on public.payments(user_id);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  portal_token text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists clients_portal_token_idx on public.clients(portal_token);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'NGN',
  date date not null,
  category text not null default 'Other',
  notes text,
  billable boolean default true,
  billed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists expenses_user_date_idx on public.expenses(user_id, date desc);
create index if not exists expenses_client_id_idx on public.expenses(client_id);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

create index if not exists templates_user_created_idx on public.templates(user_id, created_at desc);

create table if not exists public.client_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('credited', 'applied')),
  description text,
  reference_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists client_credits_user_client_idx on public.client_credits(user_id, client_id);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  estimate_number text not null,
  title text,
  status text not null default 'draft',
  valid_until date,
  currency text not null default 'NGN',
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  client_email text,
  client_token text unique default encode(gen_random_bytes(16), 'hex'),
  subtotal numeric(12,2) default 0,
  discount_type text default 'percentage',
  discount_value numeric(12,2) default 0,
  discount_amount numeric(12,2) default 0,
  tax_rate numeric(5,2) default 0,
  tax_amount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  notes text,
  terms text,
  allow_negotiation boolean default false,
  max_discount_pct numeric(5,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists estimates_user_created_idx on public.estimates(user_id, created_at desc);
create index if not exists estimates_client_token_idx on public.estimates(client_token);

create table if not exists public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  description text,
  quantity numeric(10,2) default 1,
  unit_price numeric(12,2) default 0,
  amount numeric(12,2) default 0,
  min_price numeric(12,2),
  client_proposed_price numeric(12,2),
  deleted_by_client boolean default false,
  sort_order integer default 0
);

create index if not exists estimate_line_items_estimate_sort_idx on public.estimate_line_items(estimate_id, sort_order);

create table if not exists public.estimate_events (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  event_type text not null,
  actor text not null default 'owner',
  details jsonb,
  created_at timestamptz default now()
);

create index if not exists estimate_events_estimate_created_idx on public.estimate_events(estimate_id, created_at desc);

create table if not exists public.estimate_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tax_rate numeric(5,2) default 0,
  discount_type text default 'percentage',
  discount_value numeric(12,2) default 0,
  notes text,
  terms text,
  allow_negotiation boolean default false,
  max_discount_pct numeric(5,2) default 0,
  valid_days integer default 7,
  created_at timestamptz default now()
);

create index if not exists estimate_templates_user_created_idx on public.estimate_templates(user_id, created_at desc);

create table if not exists public.estimate_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.estimate_templates(id) on delete cascade,
  description text,
  quantity numeric(10,2) default 1,
  unit_price numeric(12,2) default 0,
  min_price numeric(12,2),
  sort_order integer default 0
);

create index if not exists estimate_template_items_template_sort_idx on public.estimate_template_items(template_id, sort_order);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  subject text,
  body_html text,
  body_text text,
  recipient_mode text,
  recipient_count integer default 0,
  sent_by text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.line_items enable row level security;
alter table public.payments enable row level security;
alter table public.clients enable row level security;
alter table public.expenses enable row level security;
alter table public.templates enable row level security;
alter table public.client_credits enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_line_items enable row level security;
alter table public.estimate_events enable row level security;
alter table public.estimate_templates enable row level security;
alter table public.estimate_template_items enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users own invoices" on public.invoices;
drop policy if exists "Users manage own invoices" on public.invoices;
create policy "Users manage own invoices" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users own line items" on public.line_items;
drop policy if exists "Users manage own line items" on public.line_items;
create policy "Users manage own line items" on public.line_items
  for all using (
    invoice_id in (select id from public.invoices where user_id = auth.uid())
  ) with check (
    invoice_id in (select id from public.invoices where user_id = auth.uid())
  );

drop policy if exists "Users manage own payments" on public.payments;
create policy "Users manage own payments" on public.payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own clients" on public.clients;
create policy "Users manage own clients" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own expenses" on public.expenses;
create policy "Users manage own expenses" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own templates" on public.templates;
create policy "Users manage own templates" on public.templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own client credits" on public.client_credits;
create policy "Users manage own client credits" on public.client_credits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own estimates" on public.estimates;
create policy "Users manage own estimates" on public.estimates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own estimate line items" on public.estimate_line_items;
create policy "Users manage own estimate line items" on public.estimate_line_items
  for all using (
    estimate_id in (select id from public.estimates where user_id = auth.uid())
  ) with check (
    estimate_id in (select id from public.estimates where user_id = auth.uid())
  );

drop policy if exists "Users manage own estimate events" on public.estimate_events;
create policy "Users manage own estimate events" on public.estimate_events
  for all using (
    estimate_id in (select id from public.estimates where user_id = auth.uid())
  ) with check (
    estimate_id in (select id from public.estimates where user_id = auth.uid())
  );

drop policy if exists "Users manage own estimate templates" on public.estimate_templates;
create policy "Users manage own estimate templates" on public.estimate_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own estimate template items" on public.estimate_template_items;
create policy "Users manage own estimate template items" on public.estimate_template_items
  for all using (
    template_id in (select id from public.estimate_templates where user_id = auth.uid())
  ) with check (
    template_id in (select id from public.estimate_templates where user_id = auth.uid())
  );
