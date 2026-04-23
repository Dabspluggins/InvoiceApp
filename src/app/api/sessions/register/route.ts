import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { logAudit } from '@/lib/audit'
import { getTrustedIp } from '@/lib/utils'

function parseUserAgent(ua: string): { deviceType: string; browser: string } {
  const deviceType = /Mobile/i.test(ua) ? 'Mobile' : /Tablet|iPad/i.test(ua) ? 'Tablet' : 'Desktop'
  let browser = 'Unknown'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Chrome\//i.test(ua)) browser = 'Chrome'
  else if (/Safari\//i.test(ua)) browser = 'Safari'
  else if (/OPR\/|Opera\//i.test(ua)) browser = 'Opera'
  return { deviceType, browser }
}

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function computeHmac(message: string): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function buildSuspiciousLoginEmail({
  browser,
  deviceType,
  location,
  ip,
  timestamp,
  secureLink,
  trustLink,
}: {
  browser: string
  deviceType: string
  location: string | null
  ip: string | null
  timestamp: string
  secureLink: string
  trustLink: string
}): string {
  const displayLocation = location ?? ip ?? 'Unknown location'
  const displayTime = new Date(timestamp).toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>New sign-in to your BillByDab account</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#DC2626;padding:32px 40px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">BillByDab</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Security Alert</p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px 40px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:600;">New sign-in to your account</h2>
            <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
              We detected a sign-in to your BillByDab account from a new device and location.
            </p>
            <table cellpadding="0" cellspacing="0" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                  <span style="color:#6b7280;font-size:13px;">Device</span><br>
                  <span style="color:#111827;font-size:14px;font-weight:500;">${browser} on ${deviceType}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
                  <span style="color:#6b7280;font-size:13px;">Location</span><br>
                  <span style="color:#111827;font-size:14px;font-weight:500;">${displayLocation}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;">
                  <span style="color:#6b7280;font-size:13px;">Time</span><br>
                  <span style="color:#111827;font-size:14px;font-weight:500;">${displayTime}</span>
                </td>
              </tr>
            </table>
            <div style="text-align:center;margin-bottom:16px;">
              <a href="${secureLink}" style="display:inline-block;background:#DC2626;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
                This wasn't me — Secure My Account
              </a>
            </div>
            <p style="margin:0 0 20px;color:#9ca3af;font-size:12px;text-align:center;line-height:1.5;">
              This link expires in 24 hours. Clicking it will sign out all other devices.
            </p>
            <div style="border-top:1px solid #f3f4f6;padding-top:20px;text-align:center;">
              <p style="margin:0 0 10px;color:#374151;font-size:14px;">Recognised this sign-in?</p>
              <a href="${trustLink}" style="display:inline-block;color:#4f46e5;font-size:14px;font-weight:500;text-decoration:none;border:1px solid #e0e7ff;padding:10px 24px;border-radius:8px;background:#f5f3ff;">
                This was me — trust this device &rarr;
              </a>
              <p style="margin:10px 0 0;color:#9ca3af;font-size:12px;">
                You won't receive alerts from this device again.
              </p>
            </div>
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
</html>`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 })

  const tokenHash = await hashToken(session.access_token)
  const ua = request.headers.get('user-agent') ?? ''
  const { deviceType, browser } = parseUserAgent(ua)
  const rawIp = getTrustedIp(request)
  const ip: string | null = (rawIp === '127.0.0.1' || rawIp === '::1') ? null : rawIp

  let location: string | null = null
  if (ip && ip !== '::1' && ip !== '127.0.0.1') {
    try {
      const geo = await fetch(`https://ip-api.com/json/${ip}?fields=city,country`, { signal: AbortSignal.timeout(3000) })
      if (geo.ok) {
        const data = await geo.json()
        if (data.city && data.country) location = `${data.city}, ${data.country}`
        else if (data.country) location = data.country
      }
    } catch { /* ignore — location is optional */ }
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  await admin.from('user_sessions').upsert(
    {
      user_id: user.id,
      session_token: tokenHash,
      device_type: deviceType,
      browser,
      ip_address: ip,
      location,
      last_active: new Date().toISOString(),
    },
    { onConflict: 'session_token' }
  )

  // Suspicious login detection — run in background, don't block response
  detectAndAlertSuspiciousLogin({
    userId: user.id,
    userEmail: user.email ?? '',
    browser,
    deviceType,
    location,
    ip,
    ua,
  }).catch(console.error)

  return NextResponse.json({ ok: true })
}

async function detectAndAlertSuspiciousLogin({
  userId,
  userEmail,
  browser,
  deviceType,
  location,
  ip,
  ua,
}: {
  userId: string
  userEmail: string
  browser: string
  deviceType: string
  location: string | null
  ip: string | null
  ua: string
}) {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get profile: alerts enabled
  const { data: profile } = await admin
    .from('profiles')
    .select('login_alerts_enabled')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.login_alerts_enabled === false) return

  // Compute device fingerprint: SHA-256(browser + deviceType + first 50 chars of UA)
  const fingerprintInput = `${browser}|${deviceType}|${ua.slice(0, 50)}`
  const deviceFingerprint = await hashToken(fingerprintInput)

  // Check trusted device
  const { data: trustedDevice } = await admin
    .from('trusted_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('device_fingerprint', deviceFingerprint)
    .maybeSingle()

  if (trustedDevice) return // known trusted device

  // Check new location
  if (location) {
    const { count } = await admin
      .from('user_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('location', location)

    if ((count ?? 0) > 1) return // location seen before
  } else {
    // No location info — treat IP as location proxy
    if (ip) {
      const { count } = await admin
        .from('user_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('ip_address', ip)

      if ((count ?? 0) > 1) return
    } else {
      return // no location or IP — can't determine novelty, skip
    }
  }

  // Both device and location are new — send alert
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !userEmail) return

  const rawToken = crypto.randomUUID()
  const tokenHash = await hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  await admin
    .from('profiles')
    .update({ secure_account_token: tokenHash, secure_account_token_expires_at: expiresAt })
    .eq('id', userId)

  const label = `${browser} on ${deviceType}`
  const trustExpiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90
  const hmacMessage = `${deviceFingerprint}|${label}|${userId}|${trustExpiresAt}`
  const sig = await computeHmac(hmacMessage)
  const trustLink = `https://billbydab.com/api/sessions/trust-device-token?fingerprint=${deviceFingerprint}&label=${encodeURIComponent(label)}&uid=${userId}&expires=${trustExpiresAt}&sig=${sig}`

  const secureLink = `https://billbydab.com/api/auth/secure-account?token=${rawToken}`
  const resend = new Resend(apiKey)

  await resend.emails.send({
    from: 'BillByDab Security <security@billbydab.com>',
    to: [userEmail],
    subject: 'New sign-in to your BillByDab account',
    html: buildSuspiciousLoginEmail({
      browser,
      deviceType,
      location,
      ip,
      timestamp: new Date().toISOString(),
      secureLink,
      trustLink,
    }),
  })

  await logAudit({
    userId,
    action: 'auth.suspicious_login',
    metadata: { browser, deviceType, location, ip },
  })
}
