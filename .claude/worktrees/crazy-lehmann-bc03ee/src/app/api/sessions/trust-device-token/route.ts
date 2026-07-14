import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { computeHmac } from '@/app/api/sessions/register/route'
import { logAudit } from '@/lib/audit'

const BASE_URL = 'https://billbydab.com'

function htmlPage(title: string, success: boolean, body: string): NextResponse {
  const icon = success
    ? `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`
    : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`
  const iconBg = success ? '#dcfce7' : '#fee2e2'
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title} — BillByDab</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
    @media(prefers-color-scheme:dark){body{background:#111827}}
    .card{background:#fff;border-radius:16px;border:1px solid #e5e7eb;padding:40px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    @media(prefers-color-scheme:dark){.card{background:#1f2937;border-color:#374151}}
    .icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;background:${iconBg}}
    h1{font-size:20px;font-weight:700;color:#111827;margin-bottom:12px}
    @media(prefers-color-scheme:dark){h1{color:#f9fafb}}
    p{font-size:15px;color:#6b7280;line-height:1.6;margin-bottom:24px}
    @media(prefers-color-scheme:dark){p{color:#9ca3af}}
    a.btn{display:inline-block;background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;transition:background .15s}
    a.btn:hover{background:#4338ca}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    ${body}
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fingerprint = searchParams.get('fingerprint')
  const label = searchParams.get('label')
  const uid = searchParams.get('uid')
  const sig = searchParams.get('sig')

  if (!fingerprint || !label || !uid || !sig) {
    return htmlPage(
      'Invalid link',
      false,
      `<p>This link is missing required parameters.</p><a class="btn" href="${BASE_URL}/dashboard">Go to Dashboard</a>`,
    )
  }

  // Verify HMAC — reconstruct message exactly as it was signed
  const expectedSig = await computeHmac(`${fingerprint}|${label}|${uid}`)
  if (expectedSig !== sig) {
    return htmlPage(
      'Invalid link',
      false,
      `<p>This link is invalid or has been tampered with.</p><a class="btn" href="${BASE_URL}/dashboard">Go to Dashboard</a>`,
    )
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin
    .from('trusted_devices')
    .upsert(
      { user_id: uid, device_fingerprint: fingerprint, label },
      { onConflict: 'user_id,device_fingerprint' }
    )

  if (error) {
    console.error('trust-device-token upsert error:', error)
    return htmlPage(
      'Something went wrong',
      false,
      `<p>We couldn't save your trusted device. Please try again or add it from your settings.</p><a class="btn" href="${BASE_URL}/settings">Go to Settings</a>`,
    )
  }

  logAudit({ userId: uid, action: 'device.trusted', metadata: { label } }).catch(console.error)

  return htmlPage(
    'Device trusted',
    true,
    `<p>Device trusted successfully. You won't receive alerts from this device again.</p><a class="btn" href="${BASE_URL}/dashboard">Go to Dashboard</a>`,
  )
}
