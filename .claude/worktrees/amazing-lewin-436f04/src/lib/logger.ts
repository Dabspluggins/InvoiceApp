import { randomUUID } from 'crypto'
import * as Sentry from '@sentry/nextjs'

export function logError(
  endpoint: string,
  action: string,
  context: Record<string, unknown>,
  error: unknown
): void {
  let serializedError: Record<string, unknown>
  if (error instanceof Error) {
    serializedError = { message: error.message, name: error.name, stack: error.stack }
  } else if (error !== null && typeof error === 'object') {
    serializedError = { ...(error as Record<string, unknown>) }
  } else {
    serializedError = { raw: String(error) }
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
      Sentry.captureException(error)
    } else {
      Sentry.captureMessage(`[${endpoint}] ${action}`, 'error')
    }
  })
}
