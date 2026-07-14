-- NOTE: You must also enable TOTP MFA in the Supabase dashboard:
-- Authentication → Sign In / MFA → enable TOTP

create table mfa_backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  code_hash text not null,
  used boolean default false,
  created_at timestamptz default now()
);

create index mfa_backup_codes_user_id_idx on mfa_backup_codes(user_id);

alter table mfa_backup_codes enable row level security;

create policy "Users manage own backup codes" on mfa_backup_codes
  for all using (auth.uid() = user_id);
