/*
 * SQL to run in Supabase before using this feature:
 *
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS revoke_token text;
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS revoke_token_expires_at timestamptz;
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: dbError } = await adminClient
    .from('profiles')
    .upsert({ id: user.id, revoke_token: token, revoke_token_expires_at: expiresAt })

  if (dbError) {
    console.error('revoke-sessions db error:', dbError)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
  }
  const resend = new Resend(apiKey)

  const revokeLink = `https://billbydab.com/settings/revoke-sessions?token=${token}`

  const { error: emailError } = await resend.emails.send({
    from: 'BillByDab <invoices@billbydab.com>',
    to: [user.email],
    subject: 'Sign out from other devices — BillByDab',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Sign out from other devices</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#4F46E5;padding:32px 40px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">BillByDab</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px 40px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:600;">Sign out from other devices</h2>
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              You requested to sign out your BillByDab account from all other browsers and devices.
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6;">
              Click the button below to confirm. This link expires in <strong>1 hour</strong>.
            </p>
            <div style="text-align:center;margin-bottom:28px;">
              <a href="${revokeLink}" style="display:inline-block;background:#4F46E5;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
                Sign out other devices
              </a>
            </div>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
              If you didn't request this, you can safely ignore this email. Your account remains secure.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Sent via <strong style="color:#6b7280;">BillByDab</strong></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })

  if (emailError) {
    console.error('revoke-sessions email error:', emailError)
    return NextResponse.json({ error: 'Failed to send confirmation email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
