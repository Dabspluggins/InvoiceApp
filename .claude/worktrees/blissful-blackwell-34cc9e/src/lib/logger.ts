/**
 * Structured error logger for API routes.
 * Produces consistent, searchable log lines in Vercel Runtime Logs.
 * Drop-in replacement for bare console.error calls — swap to Sentry later
 * by changing only this file.
 *
 * Usage:
 *   logError('send-invoice', 'Failed to send', { userId, invoiceId, toEmail }, err)
 *
 * Output in logs:
 *   [send-invoice] Failed to send | {"userId":"...","invoiceId":"...","error":"...","ts":"..."}
 */
export function logError(
  endpoint: string,
  action: string,
  context: Record<string, unknown>,
  error: unknown
): void {
  const serializedError =
    error instanceof Error
      ? { message: error.message, name: error.name, stack: error.stack }
      : { raw: String(error) }

  console.error(`[${endpoint}] ${action}`, {
    ...context,
    error: serializedError,
    ts: new Date().toISOString(),
  })
}
