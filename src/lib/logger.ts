import * as Sentry from '@sentry/nextjs'

const SENSITIVE_KEYS = new Set(['email', 'token', 'password', 'secret', 'key', 'authorization', 'cookie'])

function scrubContext(ctx: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(ctx).filter(([k]) => !SENSITIVE_KEYS.has(k.toLowerCase()))
  )
}

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

  const payload = {
    ...context,
    error: serializedError,
    ts: new Date().toISOString(),
  }

  console.error(`[${endpoint}] ${action}`, payload)

  Sentry.withScope((scope) => {
    scope.setTag('endpoint', endpoint)
    scope.setTag('action', action)
    scope.setContext('details', scrubContext(context))
    if (error instanceof Error) {
      Sentry.captureException(error)
    } else {
      Sentry.captureMessage(`[${endpoint}] ${action}`, 'error')
    }
  })
}
