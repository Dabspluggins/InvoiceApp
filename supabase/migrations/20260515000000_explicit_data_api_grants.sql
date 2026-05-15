-- ================================================================
-- Explicit Data API grants for all public-schema tables
--
-- Supabase is removing the implicit grant that currently exposes
-- every new public table to the Data API automatically.
-- Effective date: October 30 2026 for existing projects.
--
-- This migration adds explicit GRANTs so nothing breaks on that
-- date. RLS policies already in place continue to restrict which
-- ROWS each role can see/modify — these GRANTs only control
-- whether PostgREST exposes the table endpoint at all.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Core user-data tables
--    Accessed directly via the authenticated supabase-js client.
--    RLS policies on each table already restrict row-level access.
-- ----------------------------------------------------------------

grant select, insert, update, delete on public.profiles              to authenticated;
grant select, insert, update, delete on public.invoices              to authenticated;
grant select, insert, update, delete on public.line_items            to authenticated;
grant select, insert, update, delete on public.payments              to authenticated;
grant select, insert, update, delete on public.clients               to authenticated;
grant select, insert, update, delete on public.expenses              to authenticated;
grant select, insert, update, delete on public.templates             to authenticated;
grant select, insert, update, delete on public.client_credits        to authenticated;
grant select, insert, update, delete on public.estimates             to authenticated;
grant select, insert, update, delete on public.estimate_line_items   to authenticated;
grant select, insert, update, delete on public.estimate_events       to authenticated;
grant select, insert, update, delete on public.estimate_templates    to authenticated;
grant select, insert, update, delete on public.estimate_template_items to authenticated;


-- ----------------------------------------------------------------
-- 2. Security/session tables
-- ----------------------------------------------------------------

-- mfa_backup_codes / trusted_devices: users manage their own rows via RLS.
grant select, insert, update, delete on public.mfa_backup_codes  to authenticated;
grant select, insert, update, delete on public.trusted_devices   to authenticated;

-- user_sessions: the broad FOR ALL policy was explicitly dropped in
-- 20260501000000_drop_user_sessions_broad_policy.sql. Authenticated users
-- may only read their own sessions; all writes go via the service-role admin client.
grant select on public.user_sessions to authenticated;

-- audit_logs: the insert policy was removed to prevent authenticated users from
-- forging audit rows. All inserts go via the service-role admin client (logAudit).
-- Authenticated users may only read their own log entries.
grant select on public.audit_logs to authenticated;


-- ----------------------------------------------------------------
-- 3. Admin-only tables
--    Accessed exclusively via the service_role admin client.
--    Explicitly revoke from anon and authenticated first so that
--    no implicit privilege can leak through, then enable RLS (belt),
--    then grant only to service_role (suspenders).
--    service_role bypasses RLS so no row-level policies are needed.
-- ----------------------------------------------------------------

revoke all on public.announcements           from anon, authenticated;
revoke all on public.user_segments           from anon, authenticated;
revoke all on public.announcement_drafts     from anon, authenticated;
revoke all on public.announcement_logs       from anon, authenticated;
revoke all on public.announcement_recipients from anon, authenticated;

alter table public.announcements           enable row level security;
alter table public.user_segments           enable row level security;
alter table public.announcement_drafts     enable row level security;
alter table public.announcement_logs       enable row level security;
alter table public.announcement_recipients enable row level security;

grant select, insert, update, delete on public.announcements           to service_role;
grant select, insert, update, delete on public.user_segments           to service_role;
grant select, insert, update, delete on public.announcement_drafts     to service_role;
grant select, insert, update, delete on public.announcement_logs       to service_role;
grant select, insert, update, delete on public.announcement_recipients to service_role;


-- ----------------------------------------------------------------
-- 4. service_role belt-and-suspenders grants for all other tables
--    service_role already bypasses RLS, but explicit grants ensure
--    PostgREST doesn't block the endpoint at the transport layer.
-- ----------------------------------------------------------------

grant select, insert, update, delete on public.profiles                to service_role;
grant select, insert, update, delete on public.invoices                to service_role;
grant select, insert, update, delete on public.line_items              to service_role;
grant select, insert, update, delete on public.payments                to service_role;
grant select, insert, update, delete on public.clients                 to service_role;
grant select, insert, update, delete on public.expenses                to service_role;
grant select, insert, update, delete on public.templates               to service_role;
grant select, insert, update, delete on public.client_credits          to service_role;
grant select, insert, update, delete on public.estimates               to service_role;
grant select, insert, update, delete on public.estimate_line_items     to service_role;
grant select, insert, update, delete on public.estimate_events         to service_role;
grant select, insert, update, delete on public.estimate_templates      to service_role;
grant select, insert, update, delete on public.estimate_template_items to service_role;
grant select, insert, update, delete on public.mfa_backup_codes        to service_role;
grant select, insert, update, delete on public.trusted_devices         to service_role;
grant select, insert, update, delete on public.user_sessions           to service_role;
grant select, insert, update, delete on public.audit_logs              to service_role;
