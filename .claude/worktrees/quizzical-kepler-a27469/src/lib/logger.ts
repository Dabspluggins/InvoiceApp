import { randomUUID } from 'crypto'
import * as Sentry from '@sentry/nextjs'

/**
 * Strips data values from Postgres constraint error messages to prevent PII
 * from appearing in server logs.
 * e.g. "Key (email)=(user@example.com) already exists" → "Key (email)=(...) already exists"
 */
function sanitizeErrorMessage(message: string): string {
  // Remove the value portion of Postgres constraint errors: Key (col)=(VALUE)
  return message.replace(/=\([^)]*\)/g, '=(...)')
}

export function logError(
  endpoint: string,
  action: string,
  context: Record<string, unknown>,
  error: unknown
): void {
  let serializedError: Record<string, unknown>
  if (error instanceof Error) {
    serializedError = {
      message: sanitizeErrorMessage(error.message),
      name: error.name,
      // Strip stack frames that might contain interpolated values
      stack: error.stack
        ? sanitizeErrorMessage(error.stack).split('\n').slice(0, 5).join('\n')
        : undefined,
    }
  } else if (error !== null && typeof error === 'object') {
    const raw = error as Record<string, unknown>
    serializedError = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [
        k,
        typeof v === 'string' ? sanitizeErrorMessage(v) : v,
      ])
    )
  } else {
    serializedError = { raw: sanitizeErrorMessage(String(error)) }
  }

  const requestId = randomUUID()

  // Full context stays in Vercel server logs — never leaves our infrastructure
  console.error(`[${endpoint}] ${action}`, {
    requestId,
    ...context,
    error: serializedError,
    ts: new Date().toISOString(),
  })

  // Only requestId goes to Sentry — no user or business data
  Sentry.withScope((scope) => {
    scope.setTag('endpoint', endpoint)
    scope.setTag('action', action)
    scope.setContext('details', { requestId })
    if (error instanceof Error) {
      const sanitized = new Error(sanitizeErrorMessage(error.message))
      sanitized.name = error.name
      Sentry.captureException(sanitized)
    } else {
      Sentry.captureMessage(`[${endpoint}] ${action}`, 'error')
    }
  })
}
