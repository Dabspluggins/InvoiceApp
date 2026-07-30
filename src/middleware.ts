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

// Single paths that are public — only the exact URL, no subpaths.
// Adding a route under one of these (e.g. /api/auth/login/debug) would NOT be public.
const PUBLIC_EXACT: string[] = [
  '/',
  '/invoice',
  '/reset-password',
  '/forgot-password',
  '/privacy',
  '/terms',
  '/contact',
  '/support',
  // Sentry tunnel — only /monitoring, not /monitoring/* subpaths.
  '/monitoring',
  // API endpoints that must be reachable without a session.
  // /api/auth/change-password and /api/auth/secure-account are intentionally excluded —
  // they require a session and are protected by middleware + their own getUser() check.
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/check-rate-limit',
  '/api/unsubscribe',
  '/api/send-invoice',
  '/api/contact',
  '/api/sessions/register',
  '/api/welcome-email',
]

// Subtrees that are intentionally public — every path under these prefixes is open.
// Any new route added under a prefix below bypasses middleware auth automatically.
// Each route in these subtrees MUST enforce its own auth/validation:
//   /auth/*         — Supabase handles the auth flow
//   /portal/*       — token-gated client portal pages
//   /i/*            — public invoice share links
//   /api/cron/*     — MUST validate CRON_SECRET header (verified: all 3 current routes do)
//   /api/webhooks/* — MUST verify webhook signature (verified: resend route uses Svix)
const PUBLIC_PREFIXES: string[] = [
  '/auth/',
  '/portal/',
  '/i/',
  '/api/cron/',
  '/api/webhooks/',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
}

export async function middleware(request: NextRequest) {
  // Best-effort rate limit on direct POST to /api/auth/login.
  // Primary protection is Upstash Redis inside the API route itself.
  // This in-memory check provides a fast-path block within a single serverless instance
  // but resets on cold start and is not shared across instances.
  if (request.nextUrl.pathname === '/api/auth/login' && request.method === 'POST') {
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

  // IMPORTANT: supabase.auth.getUser() refreshes the session cookie when the
  // access token is about to expire. Do not remove this call — it is required
  // by @supabase/ssr for correct session management in Next.js App Router.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Authenticated users visiting login/signup should go straight to the dashboard
  const AUTH_PAGES = ['/auth/login', '/auth/signup']
  if (user && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) =>
      redirectResponse.cookies.set(name, value, options)
    )
    return redirectResponse
  }

  if (!user && !isPublicPath(pathname)) {
    // API routes should get a 401, not an HTML redirect
    if (pathname.startsWith('/api/')) {
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
