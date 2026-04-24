import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

function verifyUnsubToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split('|')
    if (parts.length !== 3) return null
    const [userId, expiresAtStr, sig] = parts
    const expiresAt = parseInt(expiresAtStr, 10)
    if (Date.now() / 1000 > expiresAt) return null
    const payload = `${userId}|${expiresAtStr}`
    const secret = process.env.UNSUBSCRIBE_HMAC_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    const sigBuf = Buffer.from(sig, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length) return null
    if (!timingSafeEqual(sigBuf, expBuf)) return null
    return userId
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return new Response(unsubscribeHtml('Invalid unsubscribe link.', true), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const userId = verifyUnsubToken(token)
  if (!userId) {
    return new Response(unsubscribeHtml('Invalid or expired unsubscribe link.', true), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(unsubscribeHtml('Server configuration error. Please contact support@billbydab.com.', true), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (lookupError || !profile) {
    return new Response(unsubscribeHtml('Invalid unsubscribe link.', true), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ email_updates: false })
    .eq('id', userId)

  if (error) {
    console.error('Unsubscribe error:', error)
    return new Response(unsubscribeHtml('Something went wrong. Please contact support@billbydab.com.', true), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return new Response(unsubscribeHtml(), {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

function unsubscribeHtml(errorMessage?: string, isError = false): string {
  const message = isError
    ? `<p style="color:#dc2626;">${errorMessage}</p>`
    : `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.75;">
        You&#39;ve been unsubscribed from BillByDab product updates.
      </p>
      <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.7;">
        You&#39;ll still receive important emails about your account (invoices, security alerts, etc.).
      </p>`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed — BillByDab</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:60px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.10);">
    <div style="background:#111827;padding:28px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">BillByDab</h1>
      <p style="margin:6px 0 0;color:#9ca3af;font-size:13px;">Built in Lagos. Free everywhere.</p>
    </div>
    <div style="padding:40px;">
      <h2 style="margin:0 0 20px;color:#111827;font-size:20px;font-weight:700;">Unsubscribed</h2>
      ${message}
      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
        Changed your mind? You can re-enable product updates in your
        <a href="https://billbydab.com/settings" style="color:#4F46E5;text-decoration:none;">account settings</a>.
      </p>
    </div>
  </div>
</body>
</html>`
}
