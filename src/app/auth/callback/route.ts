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
      // Success — redirect to the intended destination
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
    // Exchange failed (expired code, etc) — send to login with error
    return NextResponse.redirect(new URL('/auth/login?error=link_expired', requestUrl.origin))
  }

  // No code param at all
  return NextResponse.redirect(new URL('/auth/login', requestUrl.origin))
}
