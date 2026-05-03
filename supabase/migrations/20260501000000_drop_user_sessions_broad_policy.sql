-- Drop overly broad RLS policies that were named after the service role but lacked
-- a TO clause, meaning they applied to all authenticated users rather than being
-- restricted to the service role. The service role bypasses RLS entirely and never
-- needed these policies — their only effect was granting excessive access to
-- regular authenticated users.

-- ── user_sessions ────────────────────────────────────────────────────────────
-- "Service role manages sessions" was FOR ALL USING (true) with no TO clause,
-- allowing any authenticated user to read, insert, update, and delete every
-- session row for every other user. Drop it.
DROP POLICY IF EXISTS "Service role manages sessions" ON user_sessions;

-- The correctly-scoped SELECT policy "Users view own sessions" was already
-- created in 20260417000003_create_user_sessions.sql (auth.uid() = user_id).
-- No new SELECT policy is needed here; adding one would create a redundant
-- duplicate that PostgreSQL would evaluate as a second permissive policy.

-- ── audit_logs ────────────────────────────────────────────────────────────────
-- "Service role inserts audit logs" was FOR INSERT WITH CHECK (true) with no TO
-- clause. Despite its name implying service-role-only access, any authenticated
-- user could call it to insert arbitrary rows into the audit log — undermining
-- the integrity of the audit trail. The service role bypasses RLS and inserts
-- via the admin client without needing any policy, so this policy is both
-- redundant and dangerous.
DROP POLICY IF EXISTS "Service role inserts audit logs" ON audit_logs;

-- The correctly-scoped SELECT policy "Users can view own audit logs" that already
-- exists on audit_logs is unaffected and remains in place.
