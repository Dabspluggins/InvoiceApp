-- =============================================================
-- Recalibrate reminder counters to manual-only sends
-- =============================================================
-- The /api/cron/overdue-reminders cron was firing every 3 days
-- across all users without consent, writing to reminders_sent and
-- last_reminder_sent_at on every automated send.
--
-- The manual "Send Reminder" button (/api/invoices/[id]/remind)
-- is the ONLY route that calls logAudit with action = 'invoice.reminded'.
-- The cron never called logAudit. So audit_logs is a clean record
-- of deliberate, owner-initiated sends only.
--
-- This migration resets both columns to reflect manual sends only,
-- derived from audit_logs. Invoices never manually reminded get
-- reminders_sent = 0 and last_reminder_sent_at = NULL.
UPDATE public.invoices i
SET
  reminders_sent = COALESCE((
    SELECT COUNT(*)
    FROM public.audit_logs al
    WHERE al.entity_type = 'invoice'
      AND al.entity_id  = i.id::text
      AND al.action     = 'invoice.reminded'
  ), 0),
  last_reminder_sent_at = (
    SELECT MAX(al.created_at)
    FROM public.audit_logs al
    WHERE al.entity_type = 'invoice'
      AND al.entity_id  = i.id::text
      AND al.action     = 'invoice.reminded'
  );
