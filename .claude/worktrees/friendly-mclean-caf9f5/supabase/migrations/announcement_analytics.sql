-- Announcement analytics tables
-- Run this migration in the Supabase SQL editor.

create table if not exists public.announcement_logs (
  id               uuid primary key default gen_random_uuid(),
  subject          text,
  body_preview     text,
  recipient_count  int default 0,
  audience_type    text check (audience_type in ('all', 'specific')),
  sent_at          timestamptz default now(),
  sent_by          text,
  delivered_count  int default 0,
  opened_count     int default 0,
  clicked_count    int default 0,
  bounced_count    int default 0
);

create table if not exists public.announcement_recipients (
  id               uuid primary key default gen_random_uuid(),
  announcement_id  uuid references public.announcement_logs(id) on delete cascade,
  resend_email_id  text,
  recipient_email  text,
  status           text default 'sent' check (status in ('sent', 'delivered', 'opened', 'clicked', 'bounced')),
  opened_at        timestamptz,
  clicked_at       timestamptz,
  created_at       timestamptz default now()
);

-- Fast webhook lookups by Resend email id
create index if not exists idx_announcement_recipients_resend_id
  on public.announcement_recipients(resend_email_id);

create index if not exists idx_announcement_recipients_announcement_id
  on public.announcement_recipients(announcement_id);

-- Atomic counter increment used by the webhook handler
create or replace function public.increment_announcement_counter(
  log_id      uuid,
  field_name  text
) returns void as $$
begin
  execute format(
    'update public.announcement_logs set %I = %I + 1 where id = $1',
    field_name, field_name
  ) using log_id;
end;
$$ language plpgsql security definer;
