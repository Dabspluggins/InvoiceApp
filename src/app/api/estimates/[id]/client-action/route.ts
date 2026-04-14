import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await req.json()
    const { client_token, action, deletedItemIds, proposedPrices } = body as {
      client_token: string
      action: 'approve' | 'revise'
      deletedItemIds: string[]
      proposedPrices?: Record<string, number>
    }

    if (!client_token || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Use service role to bypass RLS — verify token matches
    const admin = getAdmin()

    const { data: estimate, error } = await admin
      .from('estimates')
      .select('*')
      .eq('id', id)
      .eq('client_token', client_token)
      .single()

    if (error || !estimate) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
    }

    // Prevent re-submission
    if (estimate.status === 'approved' || estimate.status === 'rejected') {
      return NextResponse.json(
        { error: 'This estimate has already been responded to' },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const events: {
      estimate_id: string
      event_type: string
      actor: string
      details: Record<string, unknown> | null
    }[] = []

    if (action === 'approve') {
      await admin
        .from('estimates')
        .update({ status: 'approved', updated_at: now })
        .eq('id', id)

      events.push({
        estimate_id: id,
        event_type: 'approved',
        actor: 'client',
        details: null,
      })
    } else if (action === 'revise') {
      // Soft-delete the specified items
      const safeDeletedIds =
        Array.isArray(deletedItemIds) && deletedItemIds.length > 0 ? deletedItemIds : []

      if (safeDeletedIds.length > 0) {
        await admin
          .from('estimate_line_items')
          .update({ deleted_by_client: true })
          .in('id', safeDeletedIds)
          .eq('estimate_id', id) // extra safety — only items on this estimate

        events.push({
          estimate_id: id,
          event_type: 'item_deleted',
          actor: 'client',
          details: { item_ids: safeDeletedIds, count: safeDeletedIds.length },
        })
      }

      await admin
        .from('estimates')
        .update({ status: 'revised', updated_at: now })
        .eq('id', id)

      events.push({
        estimate_id: id,
        event_type: 'revised',
        actor: 'client',
        details: { deleted_count: safeDeletedIds.length },
      })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Handle proposed prices (server-side validation + persistence)
    if (proposedPrices && Object.keys(proposedPrices).length > 0) {
      const { data: estimateData } = await admin
        .from('estimates')
        .select('max_discount_pct')
        .eq('id', id)
        .single()
      const maxDiscountPct = estimateData?.max_discount_pct || 0

      for (const [itemId, proposed] of Object.entries(proposedPrices)) {
        const { data: itemData } = await admin
          .from('estimate_line_items')
          .select('unit_price, min_price')
          .eq('id', itemId)
          .single()
        if (!itemData) continue

        const discountFloor = itemData.unit_price * (1 - maxDiscountPct / 100)
        const itemFloor = itemData.min_price != null ? itemData.min_price : 0
        const effectiveFloor = Math.max(discountFloor, itemFloor)
        const safePrice = Math.max(Number(proposed), effectiveFloor)

        await admin
          .from('estimate_line_items')
          .update({ client_proposed_price: safePrice })
          .eq('id', itemId)
          .eq('estimate_id', id) // safety — only items on this estimate
      }
    }

    // Log all events
    if (events.length > 0) {
      await admin.from('estimate_events').insert(events)
    }

    // Notify the business owner
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      try {
        // Get owner email from auth.users
        const { data: userData } = await admin.auth.admin.getUserById(estimate.user_id)
        const ownerEmail = userData?.user?.email

        if (ownerEmail) {
          const resend = new Resend(apiKey)
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.billbydab.com'
          const estimateUrl = `${appUrl}/estimates/${id}`
          const clientName = estimate.client_name || 'Your client'
          const actionLabel = action === 'approve' ? 'approved' : 'submitted revisions on'

          await resend.emails.send({
            from: 'BillByDab <invoices@billbydab.com>',
            to: [ownerEmail],
            subject: `${clientName} has ${actionLabel} estimate ${estimate.estimate_number}`,
            html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Estimate Response</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:${action === 'approve' ? '#16a34a' : '#2563eb'};padding:28px 40px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
              ${action === 'approve' ? '✅ Estimate Approved' : '✏️ Revisions Submitted'}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px 40px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              <strong>${clientName}</strong> has ${actionLabel} estimate
              <strong>${estimate.estimate_number}</strong>${estimate.title ? ` (${estimate.title})` : ''}.
            </p>
            ${
              action === 'revise' && Array.isArray(deletedItemIds) && deletedItemIds.length > 0
                ? `<p style="margin:0 0 16px;color:#374151;font-size:14px;">
                They removed <strong>${deletedItemIds.length} item${deletedItemIds.length !== 1 ? 's' : ''}</strong> from the estimate.
              </p>`
                : ''
            }
            ${
              action === 'approve'
                ? `<p style="margin:0 0 20px;color:#374151;font-size:14px;">
                You can now convert this estimate to an invoice.
              </p>`
                : `<p style="margin:0 0 20px;color:#374151;font-size:14px;">
                Review their changes and update the estimate or convert it to an invoice.
              </p>`
            }
            <div style="text-align:center;margin-top:20px;">
              <a href="${estimateUrl}" style="display:inline-block;background:#4F46E5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
                View Estimate →
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 40px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Sent via <strong style="color:#6b7280;">BillByDab</strong></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
          })
        }
      } catch (notifyErr) {
        // Non-fatal — don't fail the request if notification fails
        console.error('Failed to send owner notification:', notifyErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('client-action error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
