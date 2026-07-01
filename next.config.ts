import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next'

// Supabase project hostname — derived from env so preview environments work correctly
const SUPABASE_HOST = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')

// PostHog ingestion host — defaults to US region; switch to https://eu.i.posthog.com for EU
const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(/\/$/, '')

// PostHog assets CDN — serves the remote config JS that the SDK injects via <script> at runtime.
// Derived from the ingestion host: us.i.posthog.com → us-assets.i.posthog.com
const POSTHOG_ASSETS_HOST = POSTHOG_HOST.replace('.i.posthog.com', '-assets.i.posthog.com')

// CSP in report-only mode: violations are logged to Sentry but nothing is blocked.
// Phase 2 will replace 'unsafe-inline' with a nonce and flip to Content-Security-Policy.
const cspDirectives = [
  // By default, only load resources from our own domain
  `default-src 'self'`,

  // Scripts: self + Cloudflare Turnstile (login/signup CAPTCHA) + PostHog assets CDN.
  // PostHog's npm SDK injects a <script> at runtime to fetch its remote config from
  // the assets CDN -- that host must be explicitly allowed here.
  // 'unsafe-inline' is required for Next.js hydration scripts and the dark mode
  // inline script in layout.tsx. This will be replaced with a nonce in Phase 2.
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com ${POSTHOG_ASSETS_HOST}`,

  // Styles: self + inline (Tailwind utility classes applied via className)
  `style-src 'self' 'unsafe-inline'`,

  // Images: self, base64 data URIs (invoice previews), Supabase Storage (logos/avatars)
  `img-src 'self' data: ${SUPABASE_HOST}`,

  // Fonts: Inter is bundled at build time and served from self -- no external font CDN
  `font-src 'self'`,

  // API / WebSocket connections: Supabase REST + Auth + Realtime (wss) + PostHog analytics.
  // Cloudflare Turnstile: the widget JS (running in parent-page context) POSTs a verification
  // request to challenges.cloudflare.com to generate the captcha token -- must be in connect-src.
  `connect-src 'self' ${SUPABASE_HOST} ${SUPABASE_HOST.replace('https://', 'wss://')} ${POSTHOG_HOST} ${POSTHOG_ASSETS_HOST} https://challenges.cloudflare.com`,

  // Frames: Cloudflare Turnstile renders its challenge in an iframe
  `frame-src https://challenges.cloudflare.com`,

  // Block all plugins (Flash, Java, etc.)
  `object-src 'none'`,

  // Restrict base tag to prevent base-tag hijacking
  `base-uri 'self'`,

  // Restrict where forms can be submitted
  `form-action 'self'`,

  // Prevent this app from being embedded in other sites
  `frame-ancestors 'self'`,

  // Send violation reports to Sentry's CSP endpoint
  `report-uri https://o4511363596222464.ingest.us.sentry.io/api/4511363612409856/security/?sentry_key=526433595a30e25a1f84633657a161f4`,
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Content-Security-Policy-Report-Only', value: cspDirectives },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: "dabsplugginsco",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});
