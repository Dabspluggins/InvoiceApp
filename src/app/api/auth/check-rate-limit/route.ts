import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/logger'

/**
 * POST /api/auth/check-rate-limit
 *
 * Previously this called limiter.limit() which burned real login/signup quota
 * on a pre-flight check, causing users to exhaust their attempts before the
 * actual auth request was made.
 *
 * Rate limiting is now enforced exclusively at the real auth routes
 * (login/route.ts, signup/route.ts). This endpoint returns a safe default so
 * any existing frontend callers don't break. If the UI needs to surface
 * "try again in X seconds" feedback, it should read the retryAfter value from
 * the 429 response on the actual auth route instead.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type } = body as { type?: 'login' | 'signup' }

    if (type !== 'login' && type !== 'signup') {
      return NextResponse.json({ error: 'type must be login or signup' }, { status: 400 })
    }

    // Non-consuming response — enforcement happens at the real auth routes.
    return NextResponse.json({ allowed: true })
  } catch (err) {
    logError('auth/check-rate-limit', 'Unhandled error', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
