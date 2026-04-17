create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_token text not null unique,
  device_type text,
  browser text,
  ip_address text,
  location text,
  last_active timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists user_sessions_user_id_idx on user_sessions(user_id);
create index if not exists user_sessions_token_idx on user_sessions(session_token);

alter table user_sessions enable row level security;

create policy "Users view own sessions" on user_sessions
  for select using (auth.uid() = user_id);

create policy "Service role manages sessions" on user_sessions
  for all using (true);
