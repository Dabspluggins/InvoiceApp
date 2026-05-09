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
