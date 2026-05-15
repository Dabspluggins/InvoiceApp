import * as Sentry from "@sentry/nextjs";

// Suppress Supabase Web Locks errors that fire on iOS Safari when a
// session-token refresh lock is interrupted by navigation. Two variants:
//   AbortError: "Lock was stolen by another request"
//   Error:      "Lock "lock:sb-..." was released because another request stole it"
// Both are known Supabase auth client noise — they do not affect users.
function isSupabaseLockError(reason: unknown): boolean {
  // Accept Error, DOMException, and any object-like rejection with a message
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'object' && reason !== null && 'message' in reason
      ? String((reason as { message: unknown }).message)
      : null
  if (!msg) return false
  // Variant 1: AbortError — "Lock was stolen by another request"
  if (msg.includes('Lock was stolen')) return true
  // Variant 2: Supabase locks.ts — "Lock "lock:sb-..." was released because another request stole it"
  if (msg.includes('lock:sb-') && msg.includes('released')) return true
  return false
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (isSupabaseLockError(event.reason)) {
      event.preventDefault()
    }
  })
}

Sentry.init({
  dsn: "https://526433595a30e25a1f84633657a161f4@o4511363596222464.ingest.us.sentry.io/4511363612409856",

  integrations: [Sentry.replayIntegration()],

  // Sample 20% of transactions for performance monitoring
  tracesSampleRate: 0.2,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Session replay disabled — invoicing data is sensitive (client names, amounts)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  sendDefaultPii: false,

  // Drop both Supabase Web Locks error variants — browser-level race conditions
  // on iOS Safari when navigation interrupts a background auth token refresh.
  // Neither indicates a real error or data loss.
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value ?? ''
    if (
      msg.includes('Lock was stolen') ||
      (msg.includes('lock:sb-') && msg.includes('released'))
    ) {
      return null
    }
    return event
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
