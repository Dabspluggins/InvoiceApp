import { NextRequest, NextResponse } from 'next/server'
import { loginLimiter, signupLimiter } from '@/lib/ratelimit'
import { getTrustedIp } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const ip = getTrustedIp(req)
    const body = await req.json()
    const { type } = body as { type?: 'login' | 'signup' }

    if (type !== 'login' && type !== 'signup') {
      return NextResponse.json({ error: 'type must be login or signup' }, { status: 400 })
    }

    const limiter = type === 'login' ? loginLimiter : signupLimiter
    const { success, reset } = await limiter.limit(ip)

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return NextResponse.json({ allowed: false, retryAfter })
    }

    return NextResponse.json({ allowed: true })
  } catch (err) {
    console.error('check-rate-limit error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
