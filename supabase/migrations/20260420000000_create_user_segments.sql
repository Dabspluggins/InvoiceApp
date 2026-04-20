create table if not exists public.user_segments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  rules       jsonb not null default '[]',
  created_at  timestamptz default now(),
  created_by  text
);
