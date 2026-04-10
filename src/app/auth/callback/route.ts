import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (next === '/reset-password') {
        // Pass tokens in the URL so the reset page doesn't rely on cookies being
        // propagated before the redirect fires (fixes intermittent cookie race).
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const resetUrl = new URL('/reset-password', requestUrl.origin)
          resetUrl.searchParams.set('access_token', session.access_token)
          resetUrl.searchParams.set('refresh_token', session.refresh_token)
          return NextResponse.redirect(resetUrl.toString())
        }
      }
      // Success — redirect to the intended destination
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
    // Exchange failed (expired code, etc) — send to login with error
    return NextResponse.redirect(new URL('/auth/login?error=link_expired', requestUrl.origin))
  }

  // No code param at all
  return NextResponse.redirect(new URL('/auth/login', requestUrl.origin))
}
