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

// Paths that do not require authentication. Everything else is protected.
const PUBLIC_PATHS: string[] = [
  // Pages
  '/auth/',
  '/reset-password',
  '/forgot-password',
  '/portal/',
  '/privacy',
  '/terms',
  '/contact',
  '/support',
  '/i/',
  // API routes that use their own auth mechanism or are intentionally public
  '/api/unsubscribe',
  '/api/send-invoice',
  '/api/contact',
  '/api/auth/',
  '/api/cron/',
  '/api/webhooks/',
  '/api/mfa/',
  '/api/sessions/register',
  '/api/welcome-email',
]

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_PATHS.some(
    p => pathname === p.replace(/\/$/, '') || pathname.startsWith(p.endsWith('/') ? p : p + '/')
  )
}

export async function proxy(request: NextRequest) {
  // Rate-limit POST submissions to the login page (4 attempts per 15 min per IP)
  if (request.nextUrl.pathname === '/auth/login' && request.method === 'POST') {
    const ip = getTrustedIp(request)
    if (!middlewareRateLimit(ip, 4, 15 * 60 * 1000)) {
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

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    // API routes should get a 401, not an HTML redirect
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
