import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

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

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 })

  const tokenHash = await hashToken(session.access_token)
  const ua = request.headers.get('user-agent') ?? ''
  const { deviceType, browser } = parseUserAgent(ua)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? request.headers.get('x-real-ip')
    ?? null

  let location: string | null = null
  if (ip && ip !== '::1' && ip !== '127.0.0.1') {
    try {
      const geo = await fetch(`http://ip-api.com/json/${ip}?fields=city,country`, { signal: AbortSignal.timeout(3000) })
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

  return NextResponse.json({ ok: true })
}
