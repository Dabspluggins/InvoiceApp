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
 * Return the number if it is finite and strictly positive, or null.
 * Use for monetary amounts, quantities, and other positive-only numerics.
 */
export function requirePositiveNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
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
