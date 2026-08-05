import { NextResponse } from 'next/server'

/** Return a 400 JSON response with a human-readable error message. */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * Parse the request body as JSON.
 * Returns { data } on success, or { error: NextResponse } with a 400 on bad JSON.
 *
 * Usage:
 *   const parsed = await readJson<MyBody>(req)
 *   if ('error' in parsed) return parsed.error
 *   const { field } = parsed.data
 */
export async function readJson<T = unknown>(
  req: Request,
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const data = (await req.json()) as T
    return { data }
  } catch {
    return { error: badRequest('Invalid JSON body') }
  }
}

/**
 * Return the trimmed string if non-empty, or null.
 * Use for required string fields — caller should reject null as a 400.
 */
export function requireString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  return null
}

/**
 * Return the trimmed string if non-empty, or null.
 * Use for optional string fields — null means absent, which may be valid.
 */
export function optionalString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  return null
}

/**
 * Return the number if it is a JSON number, finite, and strictly positive.
 * Rejects numeric strings, booleans, and other coercible types — the caller
 * must send an actual JSON number.
 * Use for monetary amounts, quantities, and other positive-only numerics.
 */
export function requirePositiveNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Return true if value is a valid UUID string (case-insensitive). */
export function validateUUID(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Return true if value looks like a valid email address. */
export function validateEmail(value: unknown): boolean {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Return true if value is a YYYY-MM-DD date string that represents a real
 * calendar date. Uses an explicit round-trip check so that dates like
 * 2026-02-31 (which Date.parse normalises to 2026-03-03) are rejected.
 */
export function validateDateOnly(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}
