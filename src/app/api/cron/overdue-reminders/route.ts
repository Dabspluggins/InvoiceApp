// Run this SQL migration in Supabase before deploying:
//
// ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;
// ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminders_sent INTEGER DEFAULT 0;

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import type { NextRequest } from 'next/server'
import { escHtml } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function currencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', NGN: '₦', CAD: 'CA$', AUD: 'A$',
  }
  return symbols[currency] ?? currency + ' '
}

function formatAmount(total: number, currency: string): string {
  return `${currencySymbol(currency)}${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildReminderEmail(opts: {
  clientName: string
  invoiceNumber: string
  total: number
  currency: string
  dueDate: string
  shareToken: string | null
  senderName: string
}): string {
  const { clientName, invoiceNumber, total, currency, dueDate, shareToken, senderName } = opts
  const safeClientName = escHtml(clientName)
  const safeInvoiceNumber = escHtml(invoiceNumber)
  const safeAmount = escHtml(formatAmount(total, currency))
  const safeSenderName = escHtml(senderName)
  const viewButton = shareToken
    ? `<p style="margin:24px 0;text-align:center;">
        <a href="https://www.billbydab.com/i/${shareToken}"
           style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">
          View Invoice →
        </a>
       </p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <!-- Header -->
        <tr><td style="background:#4f46e5;padding:24px 32px;">
          <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">BillByDab</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;color:#111827;">Hi ${safeClientName},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
            This is a friendly reminder that invoice <strong>#${safeInvoiceNumber}</strong> for
            <strong>${safeAmount}</strong> was due on
            <strong>${formatDate(dueDate)}</strong> and is still outstanding.
          </p>
          ${viewButton}
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
            If you have any questions or have already made payment, please disregard this message.
          </p>
          <p style="margin:0;font-size:15px;color:#111827;">
            Best regards,<br>
            <strong>${safeSenderName}</strong>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #f3f4f6;background:#f9fafb;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Powered by BillByDab</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY

  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    return Response.json({ error: 'Missing environment variables' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const resend = new Resend(resendKey)

  const today = new Date().toISOString().split('T')[0]
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch overdue unpaid invoices not reminded in the last 3 days
  const { data: overdueInvoices, error: fetchError } = await supabase
    .from('invoices')
    .select('id, user_id, invoice_number, client_name, client_email, total, currency, due_date, share_token, business_name, last_reminder_sent_at, reminders_sent')
    .not('status', 'in', '("paid","Paid")')
    .lt('due_date', today)
    .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${threeDaysAgo}`)

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 })
  }

  if (!overdueInvoices || overdueInvoices.length === 0) {
    return Response.json({ processed: 0, errors: [] })
  }

  let processed = 0
  const errors: string[] = []

  for (const inv of overdueInvoices) {
    try {
      // Get invoice owner's display name / email for personalisation
      const { data: userData } = await supabase.auth.admin.getUserById(inv.user_id)
      const senderName = inv.business_name
        || userData?.user?.user_metadata?.full_name
        || userData?.user?.email
        || 'Your service provider'

      const html = buildReminderEmail({
        clientName: inv.client_name || 'there',
        invoiceNumber: inv.invoice_number,
        total: inv.total,
        currency: inv.currency,
        dueDate: inv.due_date,
        shareToken: inv.share_token ?? null,
        senderName,
      })

      const { error: sendError } = await resend.emails.send({
        from: 'BillByDab Reminders <reminders@billbydab.com>',
        to: inv.client_email,
        subject: `Friendly reminder: Invoice #${inv.invoice_number} is overdue`,
        html,
      })

      if (sendError) {
        errors.push(`Invoice ${inv.invoice_number}: ${sendError.message}`)
        continue
      }

      await supabase
        .from('invoices')
        .update({
          last_reminder_sent_at: new Date().toISOString(),
          reminders_sent: (inv.reminders_sent ?? 0) + 1,
        })
        .eq('id', inv.id)

      processed++
    } catch (err) {
      errors.push(`Invoice ${inv.invoice_number}: ${String(err)}`)
    }
  }

  return Response.json({ processed, errors })
}
