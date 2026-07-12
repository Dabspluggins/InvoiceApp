import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next'

// Supabase project hostname — derived from env so preview environments work correctly
const SUPABASE_HOST = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')

// PostHog ingestion host — defaults to US region; switch to https://eu.i.posthog.com for EU
const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(/\/$/, '')

// CSP enforced: disable_external_dependency_loading in PostHogProvider removes the
// runtime <script> injection from the assets CDN that was the source of the eval() violation.
const cspDirectives = [
  // By default, only load resources from our own domain
  `default-src 'self'`,

  // Scripts: self + Cloudflare Turnstile (login/signup CAPTCHA).
  // PostHog's assets CDN removed — disable_external_dependency_loading: true prevents
  // the runtime <script> injection that was the source of the eval() CSP violation.
  // 'unsafe-inline' is required for Next.js hydration scripts and the dark mode
  // inline script in layout.tsx.
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com`,

  // Styles: self + inline (Tailwind utility classes applied via className)
  `style-src 'self' 'unsafe-inline'`,

  // Images: self, base64 data URIs (invoice previews), Supabase Storage (logos/avatars)
  `img-src 'self' data: ${SUPABASE_HOST}`,

  // Fonts: Inter is bundled at build time and served from self -- no external font CDN
  `font-src 'self'`,

  // API / WebSocket connections: Supabase REST + Auth + Realtime (wss) + PostHog analytics.
  // Cloudflare Turnstile: the widget JS (running in parent-page context) POSTs a verification
  // request to challenges.cloudflare.com to generate the captcha token -- must be in connect-src.
  `connect-src 'self' ${SUPABASE_HOST} ${SUPABASE_HOST.replace('https://', 'wss://')} ${POSTHOG_HOST} https://challenges.cloudflare.com`,

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
  { key: 'Content-Security-Policy', value: cspDirectives },
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
