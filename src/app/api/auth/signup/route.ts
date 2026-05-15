import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signupLimiter } from '@/lib/ratelimit'
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

    // 2. Rate limit (atomically bound to the sign-up attempt below)
    const ip = getTrustedIp(req)
    const { success: allowed, reset } = await signupLimiter.limit(ip)
    if (!allowed) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return NextResponse.json({ allowed: false, retryAfter }, { status: 429 })
    }

    // 3. Attempt sign-up server-side.
    //    emailRedirectTo uses NEXT_PUBLIC_SITE_URL so it works across preview
    //    environments (Vercel sets this per deployment) with a safe production fallback.
    const supabase = await createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.billbydab.com'}/auth/callback`,
        captchaToken,
      },
    })

    if (signUpError) {
      return NextResponse.json(
        { error: signUpError.message },
        { status: signUpError.status ?? 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logError('api/auth/signup', 'Unhandled error', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
