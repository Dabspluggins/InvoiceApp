import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getTrustedIp } from '@/lib/utils'

// In-memory store for login rate limiting.
// Best-effort: resets on cold start, but provides baseline protection against
// brute-force bursts within a single serverless function instance lifetime.
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function middlewareRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const record = loginAttempts.get(ip)
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (record.count >= maxRequests) return false
  record.count++
  return true
}

export async function proxy(request: NextRequest) {
  // Rate-limit POST submissions to the login page (10 attempts per 15 min per IP)
  if (request.nextUrl.pathname === '/auth/login' && request.method === 'POST') {
    const ip = getTrustedIp(request)
    if (!middlewareRateLimit(ip, 10, 15 * 60 * 1000)) {
      return new NextResponse('Too many login attempts. Please try again later.', { status: 429 })
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect dashboard route
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
