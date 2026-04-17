import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/audit'

const BASE_URL = 'https://billbydab.com'

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

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
  const rawToken = searchParams.get('token')

  if (!rawToken) {
    return htmlPage(
      'Invalid link',
      false,
      `<p>This link is invalid or has expired.</p><a class="btn" href="${BASE_URL}/settings">Back to Settings</a>`,
    )
  }

  const tokenHash = await hashToken(rawToken)

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Look up the token in profiles
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('secure_account_token', tokenHash)
    .gt('secure_account_token_expires_at', new Date().toISOString())
    .maybeSingle()

  if (!profile) {
    return htmlPage(
      'Link expired',
      false,
      `<p>This link has expired or is invalid. If you need to secure your account, please sign in and use the security settings.</p><a class="btn" href="${BASE_URL}/auth/login">Sign in</a>`,
    )
  }

  const userId = profile.id

  // Require the user to be signed in to perform the sign-out
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login, then back to this URL
    const returnUrl = encodeURIComponent(`/api/auth/secure-account?token=${rawToken}`)
    return NextResponse.redirect(`${BASE_URL}/auth/login?next=${returnUrl}`)
  }

  if (user.id !== userId) {
    return htmlPage(
      'Wrong account',
      false,
      `<p>This security link belongs to a different account. Please sign in with the correct account.</p><a class="btn" href="${BASE_URL}/auth/login">Sign in</a>`,
    )
  }

  // Get current session to perform sign-out
  const { data: { session } } = await supabase.auth.getSession()

  // Sign out all sessions globally (including the current one for maximum security)
  const { error: signOutError } = await admin.auth.admin.signOut(
    session?.access_token ?? '',
    'global'
  )

  // Clear the secure_account_token regardless of sign-out result
  await admin
    .from('profiles')
    .update({ secure_account_token: null, secure_account_token_expires_at: null })
    .eq('id', userId)

  if (signOutError) {
    console.error('secure-account signout error:', signOutError)
    return htmlPage(
      'Something went wrong',
      false,
      `<p>We couldn't sign out other devices. Please try again or contact support.</p><a class="btn" href="${BASE_URL}/settings">Back to Settings</a>`,
    )
  }

  await logAudit({ userId, action: 'auth.secured' })

  return htmlPage(
    'Account secured',
    true,
    `<p>All devices have been signed out. Your account is now secure.</p><p style="margin-bottom:24px">You can now sign in again from your trusted device.</p><a class="btn" href="${BASE_URL}/auth/login">Sign in</a>`,
  )
}
