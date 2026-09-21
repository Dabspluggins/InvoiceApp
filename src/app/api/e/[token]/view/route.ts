import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logError } from '@/lib/logger'
import { escHtml } from '@/lib/utils'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * PUBLIC ENDPOINT — records that the client opened an estimate.
 *
 * This deliberately does NOT run while the page renders. Estimate links are
 * emailed to third parties, and corporate mail scanners follow links in
 * inbound mail. A GET-triggered write would report "your client opened this"
 * every time a scanner or link preview touched the URL, before any human saw
 * it. Scanners do not execute JavaScript, so firing from the mounted client
 * component is what makes the signal mean something.
 *
 * First view only, enforced in the database rather than by a read-then-write
 * check here — concurrent tabs would otherwise both notify. A second call is a
 * no-op, so reloads and extra tabs never re-notify.
 *
 * The share token in the path is the only credential and is validated here.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  let id = ''

  try {
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const admin = getAdmin()

    // client_token is UNIQUE — resolves to exactly one estimate.
    const { data: estimate, error } = await admin
      .from('estimates')
      .select('*')
      .eq('client_token', token)
      .single()

    if (error || !estimate) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
    }

    id = estimate.id

    // Atomic first-view check. The database decides, not us: a partial unique
    // index on estimate_events makes a second client_viewed row impossible, so
    // concurrent tabs resolve to exactly one winner. Checking for a prior event
    // and then inserting would let two callers both pass the check and both
    // notify the owner. See 20260921000000_estimate_client_view_idempotency.sql.
    const { data: isFirstView, error: viewError } = await admin.rpc(
      'record_estimate_client_view',
      { p_token: token }
    )

    if (viewError) {
      logError('e/[token]/view', 'record_estimate_client_view failed', { estimateId: id }, viewError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Not the first view — the owner has already been told.
    if (!isFirstView) {
      return NextResponse.json({ ok: true, firstView: false })
    }

    // Notify the owner. Non-fatal — never fail the request over a notification.
    try {
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey) {
        const { data: userData } = await admin.auth.admin.getUserById(estimate.user_id)
        const ownerEmail = userData?.user?.email
        if (ownerEmail) {
          const { Resend } = await import('resend')
          const resend = new Resend(apiKey)
          const clientDisplayName = estimate.client_name || 'Your client'
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vortali.com'
          await resend.emails.send({
            from: 'Vortali <noreply@vortali.com>',
            to: ownerEmail,
            subject: `${clientDisplayName} has opened estimate ${estimate.estimate_number}`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #4F46E5;">Estimate Opened</h2>
              <p><strong>${escHtml(clientDisplayName)}</strong> has just opened and is reviewing your estimate <strong>${escHtml(estimate.estimate_number)}</strong>.</p>
              ${estimate.title ? `<p style="color: #6B7280;">${escHtml(estimate.title)}</p>` : ''}
              <p>They may approve, edit, or send back a revised version soon.</p>
              <a href="${appUrl}/estimates/${estimate.id}"
                 style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
                View Estimate
              </a>
            </div>
          `,
          })
        }
      }
    } catch (notifyErr) {
      logError('e/[token]/view', 'Owner open notification failed', { estimateId: id }, notifyErr)
    }

    return NextResponse.json({ ok: true, firstView: true })
  } catch (err) {
    logError('e/[token]/view', 'Unhandled error', { estimateId: id }, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
