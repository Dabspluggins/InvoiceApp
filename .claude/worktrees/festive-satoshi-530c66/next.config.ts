import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next'

const securityHeaders = [
  // Prevent browsers from guessing the content type (MIME sniffing)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Prevent the app being embedded in iframes on other sites (clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Control how much referrer info is sent when navigating away
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Force HTTPS for 2 years, including subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Disable browser features the app doesn't use
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Enable DNS prefetching for performance
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
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
