import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loginLimiter } from '@/lib/ratelimit'
import { getTrustedIp } from '@/lib/utils'
import { logError } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    // 1. Parse and validate body
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { email, password, captchaToken } = body as {
      email?: unknown
      password?: unknown
      captchaToken?: unknown
    }

    if (typeof email !== 'string' || !email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    if (typeof password !== 'string' || !password) {
      return NextResponse.json({ error: 'password is required' }, { status: 400 })
    }
    if (typeof captchaToken !== 'string' || !captchaToken) {
      return NextResponse.json({ error: 'captchaToken is required' }, { status: 400 })
    }

    // 2. Rate limit (atomically bound to the sign-in attempt below)
    const ip = getTrustedIp(req)
    const { success: allowed, reset } = await loginLimiter.limit(ip)
    if (!allowed) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return NextResponse.json({ allowed: false, retryAfter }, { status: 429 })
    }

    // 3. Attempt sign-in server-side so the session cookie is set by the server,
    //    not by the browser Supabase client.
    const supabase = await createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    })

    if (signInError) {
      // Always return a fixed generic message for auth failures so we don't
      // leak whether the email exists, whether it's unconfirmed, disabled, etc.
      // Supabase can return distinguishable messages like "Invalid login credentials",
      // "Email not confirmed", "User is disabled" — none of that reaches the client.
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    // 4. Check whether MFA step-up is required for this session
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const mfaRequired =
      aalData?.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2'

    return NextResponse.json({ success: true, mfaRequired })
  } catch (err) {
    logError('api/auth/login', 'Unhandled error', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
