import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = 'enyinnayadaberechi@gmail.com'

type Rule = {
  field: string
  operator: string
  value: string | number | boolean
}

type UserData = {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_updates: boolean
  invoice_count: number
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { rules } = body as { rules?: Rule[] }

  if (!Array.isArray(rules)) {
    return NextResponse.json({ error: 'rules array required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Fetch all auth users (paginated)
  const allAuthUsers: Array<{
    id: string
    email?: string
    created_at: string
    last_sign_in_at?: string
  }> = []
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    allAuthUsers.push(...(data.users as typeof allAuthUsers))
    if (data.users.length < 1000) break
    page++
  }

  // Fetch profile email_updates flags
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email_updates')
  const profileMap = new Map<string, boolean>(
    (profiles ?? []).map((p: { id: string; email_updates: boolean | null }) => [
      p.id,
      p.email_updates ?? false,
    ])
  )

  // Fetch all invoices to count per user
  const { data: invoiceRows } = await admin
    .from('invoices')
    .select('user_id')
  const invoiceCountMap = new Map<string, number>()
  for (const row of (invoiceRows ?? [])) {
    if (row.user_id) {
      invoiceCountMap.set(row.user_id, (invoiceCountMap.get(row.user_id) ?? 0) + 1)
    }
  }

  // Build merged user data
  const users: UserData[] = allAuthUsers
    .filter((u): u is typeof u & { email: string } => Boolean(u.email))
    .map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_updates: profileMap.get(u.id) ?? false,
      invoice_count: invoiceCountMap.get(u.id) ?? 0,
    }))

  // Apply all rules (AND logic)
  const matched = rules.length === 0
    ? users
    : users.filter(u => rules.every(rule => matchesRule(u, rule)))

  return NextResponse.json({ count: matched.length, userIds: matched.map(u => u.id) })
}

function matchesRule(user: UserData, rule: Rule): boolean {
  const { field, operator, value } = rule
  switch (field) {
    case 'created_at': {
      const userTs = new Date(user.created_at).getTime()
      const ruleTs = new Date(value as string).getTime()
      if (isNaN(ruleTs)) return false
      if (operator === 'after') return userTs > ruleTs
      if (operator === 'before') return userTs < ruleTs
      return false
    }
    case 'email_updates': {
      const boolVal = typeof value === 'boolean' ? value : value === 'true'
      return user.email_updates === boolVal
    }
    case 'invoice_count': {
      const num = Number(value)
      if (isNaN(num)) return false
      if (operator === 'gt') return user.invoice_count > num
      if (operator === 'lt') return user.invoice_count < num
      if (operator === 'eq') return user.invoice_count === num
      return false
    }
    case 'days_since_active': {
      if (!user.last_sign_in_at) return false
      const days = (Date.now() - new Date(user.last_sign_in_at).getTime()) / 86400000
      const num = Number(value)
      if (isNaN(num)) return false
      if (operator === 'lt') return days < num
      if (operator === 'gt') return days > num
      return false
    }
    default:
      return false
  }
}
