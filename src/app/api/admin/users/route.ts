import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'enyinnayadaberechi@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email_updates')

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; email_updates: boolean | null }) => [p.id, p.email_updates])
  )

  const allAuthUsers: Array<{
    id: string
    email: string
    created_at: string
    user_metadata: Record<string, unknown>
  }> = []

  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    allAuthUsers.push(...(data.users as typeof allAuthUsers))
    if (data.users.length < 1000) break
    page++
  }

  const users = allAuthUsers.map(u => ({
    id: u.id,
    email: u.email,
    name: (u.user_metadata?.full_name as string | undefined) ?? null,
    created_at: u.created_at,
    email_updates: profileMap.has(u.id) ? (profileMap.get(u.id) ?? null) : null,
  }))

  return NextResponse.json({ users })
}
