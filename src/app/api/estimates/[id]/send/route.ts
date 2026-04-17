import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { getCurrencySymbol } from '@/lib/currencies'
import { sendLimiter } from '@/lib/ratelimit'
import { logAudit } from '@/lib/audit'

interface LineItem {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

function fmt(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency)
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function buildEstimateEmail({
  toName,
  estimate,
  lineItems,
  reviewUrl,
}: {
  toName: string
  estimate: {
    estimate_number: string
    title: string | null
    valid_until: string | null
    currency: string
    subtotal: number
    tax_rate: number
    tax_amount: number
    discount_type: string
    discount_value: number
    discount_amount: number
    total: number
    notes: string | null
  }
  lineItems: LineItem[]
  reviewUrl: string
}): string {
  const brandColor = '#4F46E5'

  const lineItemRows = lineItems
    .map(
      (item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;">${item.description || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;text-align:right;">${fmt(item.unit_price, estimate.currency)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;font-size:14px;text-align:right;">${fmt(item.amount, estimate.currency)}</td>
    </tr>`
    )
    .join('')

  const discountRow =
    estimate.discount_value > 0
      ? `<tr>
      <td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;font-size:14px;">
        Discount${estimate.discount_type === 'percentage' ? ` (${estimate.discount_value}%)` : ''}
      </td>
      <td style="padding:8px 12px;text-align:right;color:#ef4444;font-size:14px;">−${fmt(estimate.discount_amount, estimate.currency)}</td>
    </tr>`
      : ''

  const taxRow =
    estimate.tax_rate > 0
      ? `<tr>
      <td colspan="3" style="padding:8px 12px;text-align:right;color:#6b7280;font-size:14px;">Tax (${estimate.tax_rate}%)</td>
      <td style="padding:8px 12px;text-align:right;color:#6b7280;font-size:14px;">${fmt(estimate.tax_amount, estimate.currency)}</td>
    </tr>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Estimate ${estimate.estimate_number}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:${brandColor};padding:32px 40px;border-radius:12px 12px 0 0;">
            <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Estimate for review</p>
            <h1 style="margin:4px 0 0;color:#ffffff;font-size:26px;font-weight:700;">${estimate.estimate_number}</h1>
            ${estimate.title ? `<p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">${estimate.title}</p>` : ''}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px 40px;">

            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
              Hi ${toName || 'there'},<br><br>
              Please find your estimate ${estimate.estimate_number} below.
              ${estimate.valid_until ? `This estimate is valid until <strong>${formatDate(estimate.valid_until)}</strong>.` : ''}
              <br><br>
              You can review the items, remove anything you don't need, and either approve it or send back your revisions.
            </p>

            ${
              estimate.valid_until
                ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding:12px 16px;background:#f9fafb;border-radius:8px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#6b7280;font-size:13px;font-weight:500;">Valid Until</td>
                      <td style="color:#111827;font-size:13px;font-weight:600;text-align:right;">${formatDate(estimate.valid_until)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>`
                : ''
            }

            <!-- Line items table -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
                  <th style="padding:10px 12px;text-align:center;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Unit Price</th>
                  <th style="padding:10px 12px;text-align:right;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding:10px 12px;text-align:right;color:#6b7280;font-size:14px;border-top:1px solid #e5e7eb;">Subtotal</td>
                  <td style="padding:10px 12px;text-align:right;color:#374151;font-size:14px;border-top:1px solid #e5e7eb;">${fmt(estimate.subtotal, estimate.currency)}</td>
                </tr>
                ${discountRow}
                ${taxRow}
                <tr style="background:#f9fafb;">
                  <td colspan="3" style="padding:12px;text-align:right;color:#111827;font-size:16px;font-weight:700;border-top:2px solid #e5e7eb;">Total</td>
                  <td style="padding:12px;text-align:right;color:${brandColor};font-size:18px;font-weight:700;border-top:2px solid #e5e7eb;">${fmt(estimate.total, estimate.currency)}</td>
                </tr>
              </tfoot>
            </table>

            ${
              estimate.notes
                ? `<div style="background:#fafafa;border-left:3px solid ${brandColor};padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:24px;">
              <p style="margin:0;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Notes</p>
              <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${estimate.notes}</p>
            </div>`
                : ''
            }

            <!-- CTA -->
            <div style="margin-top:28px;padding:20px;background:#f9fafb;border-radius:8px;text-align:center;">
              <p style="margin:0 0 12px;color:#374151;font-size:14px;font-weight:500;">Review this estimate and let us know your decision</p>
              <a href="${reviewUrl}"
                style="display:inline-block;background:${brandColor};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
                Review Estimate →
              </a>
              <p style="margin:10px 0 0;color:#9ca3af;font-size:12px;">or copy this link: ${reviewUrl}</p>
            </div>

            <p style="margin:24px 0 0;color:#6b7280;font-size:14px;">Questions? Reply to this email and we'll get back to you.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">This estimate was sent via <strong style="color:#6b7280;">BillByDab</strong></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success, reset } = await sendLimiter.limit(user.id)
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { toEmail, toName } = body

    if (!toEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })
    }

    // Fetch estimate (must belong to this user)
    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (estError || !estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    const { data: lineItems } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', id)
      .eq('deleted_by_client', false)
      .order('sort_order')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.billbydab.com'
    const reviewUrl = `${appUrl}/estimates/${id}/review?token=${estimate.client_token}`

    const html = buildEstimateEmail({
      toName: toName || estimate.client_name || '',
      estimate,
      lineItems: (lineItems || []) as LineItem[],
      reviewUrl,
    })

    const resend = new Resend(apiKey)
    const { error: sendError } = await resend.emails.send({
      from: 'BillByDab <invoices@billbydab.com>',
      to: [toEmail],
      subject: `Estimate ${estimate.estimate_number} — please review`,
      html,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: sendError.message }, { status: 500 })
    }

    // Update status to 'sent'
    await supabase
      .from('estimates')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', id)

    // Log event
    await supabase.from('estimate_events').insert({
      estimate_id: id,
      event_type: 'sent',
      actor: 'owner',
      details: { to: toEmail, name: toName },
    })

    logAudit({
      userId: user.id,
      action: 'estimate.sent',
      entityType: 'estimate',
      entityId: id,
      metadata: { to: toEmail },
    }).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('send estimate error:', err)
    return NextResponse.json({ error: 'Failed to send estimate' }, { status: 500 })
  }
}
