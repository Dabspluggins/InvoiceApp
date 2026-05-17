'use client'

/**
 * PostHogProvider
 *
 * Initialises PostHog analytics once on the client and tracks SPA page
 * navigation automatically.  Safe defaults:
 *
 *  - autocapture: false  — prevents PostHog from recording keystrokes /
 *                          button text that could contain invoice or client data.
 *  - person_profiles: 'identified_only'  — anonymous visitors are tracked as
 *                                          events only, never as named persons.
 *  - capture_pageview: false  — we fire $pageview manually below so Next.js
 *                               client-side routing is handled correctly.
 *  - capture_pageleave: false — PostHog controls the URL for pageleave internally;
 *                               disabling prevents leaking sensitive params on exit.
 *
 * URL sanitization: query params that may carry one-time tokens or auth secrets
 * are stripped before the $current_url is sent.  Pathname-only tracking keeps
 * analytics useful (which pages are visited) without exposing document tokens,
 * auth callbacks, or revoke-session links.
 *
 * If NEXT_PUBLIC_POSTHOG_KEY is not set (e.g. local dev without the var),
 * the provider is a silent no-op — no errors, no network requests.
 */

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { Suspense, useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Build a safe URL for PostHog: pathname only, no query string.
 *
 * Query params in this app can carry invoice tokens, portal links, auth
 * callbacks, client identifiers, and other user-controlled values.  Stripping
 * the entire query string is the only way to guarantee none of that leaks to
 * PostHog.  Pathname alone is sufficient for page-traffic analytics.
 */
function sanitizeUrl(pathname: string): string {
  return window.location.origin + pathname
}

// ── Page-view tracker ────────────────────────────────────────────────────────
// Must live inside <Suspense> because useSearchParams() opts the subtree into
// client-side rendering (Next.js App Router requirement).
function PostHogPageView() {
  const pathname = usePathname()
  const ph = usePostHog()

  useEffect(() => {
    if (!ph || !pathname) return
    ph.capture('$pageview', { $current_url: sanitizeUrl(pathname) })
  }, [pathname, ph])

  return null
}

// ── Provider ─────────────────────────────────────────────────────────────────
export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return // no-op when env var is absent

    posthog.init(key, {
      api_host:         process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      person_profiles:  'identified_only',
      capture_pageview: false,  // handled by PostHogPageView below
      capture_pageleave: false, // disabled — PostHog's internal URL capture can't be sanitized
      autocapture:      false,  // keep tracking explicit — don't sniff form values
    })
  }, [])

  return (
    <PHProvider client={posthog}>
      {/* Suspense boundary kept for future hooks that may opt into client rendering */}
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}
