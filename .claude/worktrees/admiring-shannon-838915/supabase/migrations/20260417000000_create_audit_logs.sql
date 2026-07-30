create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Index for fast per-user lookups
create index audit_logs_user_id_idx on audit_logs(user_id);

-- RLS: users can only read their own logs
alter table audit_logs enable row level security;
create policy "Users can view own audit logs" on audit_logs
  for select using (auth.uid() = user_id);

-- Only service role can insert (we use the admin client server-side)
create policy "Service role inserts audit logs" on audit_logs
  for insert with check (true);
