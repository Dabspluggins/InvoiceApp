create table if not exists public.announcement_drafts (
  id             uuid primary key default gen_random_uuid(),
  subject        text not null default '',
  body_html      text not null default '',
  body_text      text not null default '',
  recipient_mode text not null default 'all' check (recipient_mode in ('all', 'specific', 'segment')),
  recipient_ids  jsonb default '[]',
  segment_id     uuid references public.user_segments(id) on delete set null,
  status         text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'failed')),
  scheduled_for  timestamptz,
  error_message  text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists idx_announcement_drafts_status
  on public.announcement_drafts(status);

create index if not exists idx_announcement_drafts_scheduled
  on public.announcement_drafts(scheduled_for)
  where status = 'scheduled';
