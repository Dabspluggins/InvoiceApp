-- trusted_devices table
create table if not exists trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  device_fingerprint text not null,
  label text,
  created_at timestamptz default now()
);

create index if not exists trusted_devices_user_id_idx on trusted_devices(user_id);
create unique index if not exists trusted_devices_user_fingerprint_idx on trusted_devices(user_id, device_fingerprint);

alter table trusted_devices enable row level security;
create policy "Users manage own trusted devices" on trusted_devices
  for all using (auth.uid() = user_id);

-- profiles: login alert columns
alter table profiles add column if not exists login_alerts_enabled boolean default true;
alter table profiles add column if not exists secure_account_token text;
alter table profiles add column if not exists secure_account_token_expires_at timestamptz;
