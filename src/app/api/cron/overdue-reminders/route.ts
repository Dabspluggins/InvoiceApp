// This automatic reminder cron has been intentionally disabled.
// Reminder emails are sent exclusively via the manual "Send Reminder"
// action in the dashboard (/api/invoices/[id]/remind).
//
// If opt-in auto-reminders are added as a product feature in future,
// this file should be rebuilt from scratch with proper user controls.

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ disabled: true }, { status: 410 })
}
