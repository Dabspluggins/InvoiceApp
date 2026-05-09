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
  console.error(`[${endpoint}] ${action}`, {
    ...context,
    error: serializedError,
    ts: new Date().toISOString(),
  })
}
