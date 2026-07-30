import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * Server-side admin check. Returns true if the given userId has role = 'admin'
 * in the profiles table.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role === 'admin'
}
