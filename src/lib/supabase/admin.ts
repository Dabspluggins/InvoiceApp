import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client authenticated with the service-role key.
 *
 * Validates required env vars and throws if either is missing so callers
 * fail fast (500) rather than silently making unauthenticated requests.
 *
 * Usage:
 *   import { createAdminClient } from '@/lib/supabase/admin'
 *   const admin = createAdminClient()
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Server misconfigured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
    )
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
