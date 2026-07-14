import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { PaymentDetails } from '@/lib/types'
import { getCurrencySymbol } from '@/lib/currencies'
import { createClient } from '@/lib/supabase/server'
import { sendLimiter } from '@/lib/ratelimit'
import { logAudit } from '@/lib/audit'

interface LineItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

interface InvoicePayload {
  invoiceId?: string
  shareToken?: string
  toEmail: string
  toName: string
  subject: string
  message: string
  invoiceData: {
    invoiceNumber: string
    issueDate: string
    dueDate: string
    currency: string
    businessName: string
    businessEmail: string
    logoUrl?: string | null
    clientName: string
    clientCompany: string
    lineItems: LineItem[]
    taxRate: number
    subtotal: number
    taxAmount: number
    total: number
    notes: string
    brandColor: string
    paymentDetails?: PaymentDetails
  }
}

function formatCurrency(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency)
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${symbol}${formatted}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function row(label: string, value?: string): string {
  if (!value) return ''
  return `<tr>
    <td style="padding:4px 0;color:#6b7280;font-size:13px;width:160px;vertical-align:top;">${label}</td>
    <td style="padding:4px 0;color:#111827;font-size:13px;vertical-align:top;word-break:break-all;">${value}</td>
  </tr>`
}

function buildPaymentDetailsHtml(pd?: PaymentDetails): string {
  if (!pd) return ''
  const bt = pd.bankTransfer
  const mm = pd.mobileMoney
  const ot = pd.other
  const hasBT = bt && Object.values(bt).some(Boolean)
  const hasMM = mm && (mm.provider || mm.phoneNumber)
  const hasOT = ot && (ot.paymentMethod || ot.details)
  if (!hasBT && !hasMM && !hasOT) return ''

  let sections = ''

  if (hasBT) {
    sections += `<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Bank Transfer</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      ${row('Account Name', bt?.accountName)}
      ${row('Bank Name', bt?.bankName)}
      ${row('Account Number', bt?.accountNumber)}
      ${row('Sort Code / Routing', bt?.routingNumber)}
      ${row('SWIFT / IBAN', bt?.swiftIban)}
    </table>`
  }

  if (hasMM) {
    sections += `<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Mobile Money</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      ${row('Provider', mm?.provider)}
      ${row('Phone / Account', mm?.phoneNumber)}
    </table>`
  }

  if (hasOT) {
    sections += `<p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">${ot?.paymentMethod || 'Other'}</p>
    ${ot?.details ? `<p style="margin:0 0 12px;color:#374151;font-size:13px;line-height:1.5;">${ot.details.replace(/\n/g, '<br>')}</p>` : ''}`
  }

  return `<div style="margin:24px 0;padding:16px;background:#F9FAFB;border-radius:8px;border:1px solid #e5e7eb;">
  <p style="margin:0 0 12px;font-weight:600;color:#111827;font-size:14px;">Payment Details</p>
  ${sections}
</div>`
}

function buildEmailHtml(payload: InvoicePayload): string {
  const { invoiceData, message, shareToken } = payload
  const { brandColor = '#4F46E5' } = invoiceData

  const lineItemRows = invoiceData.lineItems
    .map(
      (item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;">${item.description || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;text-align:right;">${formatCurrency(item.rate, invoiceData.currency)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;text-align:right;">${formatCurrency(item.amount, invoiceData.currency)}</td>
    </tr>`
    )
    .join('')

  const taxRow =
    invoiceData.taxRate > 0
      ? `<tr>
      <td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;font-size:14px;">Tax (${invoiceData.taxRate}%)</td>
      <td style="padding:8px 12px;text-align:right;color:#6b7280;font-size:14px;">${formatCurrency(invoiceData.taxAmount, invoiceData.currency)}</td>
    </tr>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${payload.subject}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:${brandColor};padding:32px 40px;border-radius:12px 12px 0 0;">
            ${invoiceData.logoUrl ? `<img src="${invoiceData.logoUrl}" alt="Logo" style="display:block;max-height:64px;max-width:200px;object-fit:contain;margin-bottom:12px;background:rgba(255,255,255,0.1);border-radius:4px;padding:4px;">` : ''}
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Invoice from</p>
            <h1 style="margin:4px 0 0;color:#ffffff;font-size:26px;font-weight:700;">${invoiceData.businessName || 'Your Business'}</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px 40px;">

            <!-- Message -->
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6;">${message.replace(/\n/g, '<br>')}</p>

            <!-- Invoice details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding:12px 16px;background:#f9fafb;border-radius:8px 8px 0 0;border-bottom:1px solid #e5e7eb;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#6b7280;font-size:13px;font-weight:500;">Invoice Number</td>
                      <td style="color:#111827;font-size:13px;font-weight:600;text-align:right;">${invoiceData.invoiceNumber}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#6b7280;font-size:13px;font-weight:500;">Issue Date</td>
                      <td style="color:#111827;font-size:13px;font-weight:600;text-align:right;">${formatDate(invoiceData.issueDate)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${invoiceData.dueDate ? `<tr>
                <td style="padding:12px 16px;background:#f9fafb;border-radius:0 0 8px 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#6b7280;font-size:13px;font-weight:500;">Due Date</td>
                      <td style="color:#111827;font-size:13px;font-weight:600;text-align:right;">${formatDate(invoiceData.dueDate)}</td>
                    </tr>
                  </table>
                </td>
              </tr>` : ''}
            </table>

            <!-- Line items table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
                  <th style="padding:10px 12px;text-align:center;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Rate</th>
                  <th style="padding:10px 12px;text-align:right;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding:10px 12px;text-align:right;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">Subtotal</td>
                  <td style="padding:10px 12px;text-align:right;color:#374151;font-size:14px;border-top:1px solid #e5e7eb;">${formatCurrency(invoiceData.subtotal, invoiceData.currency)}</td>
                </tr>
                ${taxRow}
                <tr style="background:#f9fafb;">
                  <td colspan="3" style="padding:12px;text-align:right;color:#111827;font-size:16px;font-weight:700;border-top:2px solid #e5e7eb;">Total Due</td>
                  <td style="padding:12px;text-align:right;color:${brandColor};font-size:18px;font-weight:700;border-top:2px solid #e5e7eb;">${formatCurrency(invoiceData.total, invoiceData.currency)} ${invoiceData.currency}</td>
                </tr>
              </tfoot>
            </table>

            ${invoiceData.notes ? `<div style="background:#fafafa;border-left:3px solid ${brandColor};padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;">
              <p style="margin:0;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Notes</p>
              <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${invoiceData.notes}</p>
            </div>` : ''}

            ${buildPaymentDetailsHtml(invoiceData.paymentDetails)}

            <p style="margin:0;color:#6b7280;font-size:14px;">Questions? Reply to this email and we'll get back to you.</p>

            ${shareToken ? `<div style="margin-top:24px; padding:16px; background:#F9FAFB; border-radius:8px; text-align:center;">
              <p style="margin:0 0 8px; color:#6B7280; font-size:14px;">View this invoice online</p>
              <a href="https://www.billbydab.com/i/${shareToken}" style="display:inline-block; background:#4F46E5; color:#fff; padding:10px 24px; border-radius:6px; text-decoration:none; font-weight:600;">View Invoice →</a>
            </div>` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">This invoice was sent via <strong style="color:#6b7280;">BillByDab</strong></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const identifier = user?.id ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const { success, reset } = await sendLimiter.limit(identifier)
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter },
      { status: 429 }
    )
  }

  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
    }
    const resend = new Resend(apiKey)

    const body: InvoicePayload = await req.json()
    const { toEmail, toName, subject, invoiceData } = body

    if (!toEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
    }

    // Compute totals if not provided
    const subtotal = invoiceData.subtotal ?? invoiceData.lineItems.reduce((s, i) => s + i.amount, 0)
    const taxAmount = invoiceData.taxAmount ?? subtotal * ((invoiceData.taxRate ?? 0) / 100)
    const total = invoiceData.total ?? subtotal + taxAmount
    const enrichedPayload = { ...body, invoiceData: { ...invoiceData, subtotal, taxAmount, total } }

    const html = buildEmailHtml(enrichedPayload)

    const { error } = await resend.emails.send({
      from: 'BillByDab <invoices@billbydab.com>',
      to: [toEmail],
      subject,
      html,
      replyTo: invoiceData.businessEmail || undefined,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (user) {
      logAudit({
        userId: user.id,
        action: 'invoice.sent',
        entityType: 'invoice',
        entityId: body.invoiceId,
        metadata: { to: toEmail },
      }).catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('send-invoice error:', err)
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 })
  }
}
