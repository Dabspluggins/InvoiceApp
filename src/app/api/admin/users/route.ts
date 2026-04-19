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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email_updates')

  const profileMap = new Map<string, { full_name: string | null; email_updates: boolean | null }>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, { full_name: p.full_name ?? null, email_updates: p.email_updates ?? null })
  }

  const allUsers: Array<{ id: string; email: string; created_at: string }> = []

  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    allUsers.push(...(data.users as typeof allUsers))
    if (data.users.length < 1000) break
    page++
  }

  const users = allUsers
    .filter(u => u.email)
    .map(u => {
      const profile = profileMap.get(u.id)
      return {
        id: u.id,
        email: u.email,
        full_name: profile?.full_name ?? null,
        created_at: u.created_at,
        email_updates: profile?.email_updates ?? null,
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ users })
}
