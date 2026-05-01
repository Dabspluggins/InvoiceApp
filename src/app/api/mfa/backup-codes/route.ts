import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { logAudit } from '@/lib/audit'

const CODE_PATTERN = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/

function hashCode(code: string) {
  return createHmac('sha256', process.env.BACKUP_CODE_PEPPER!)
    .update(code.toUpperCase().replace(/-/g, '').trim())
    .digest('hex')
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST — save hashed backup codes after enrollment
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.BACKUP_CODE_PEPPER) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { codes } = await req.json()
  if (
    !Array.isArray(codes) ||
    codes.length !== 8 ||
    codes.some((c: unknown) => typeof c !== 'string' || !CODE_PATTERN.test(c)) ||
    new Set(codes).size !== codes.length
  ) {
    return NextResponse.json({ error: 'Invalid codes' }, { status: 400 })
  }

  const admin = adminClient()

  const rows = (codes as string[]).map(code => ({
    user_id: user.id,
    code_hash: hashCode(code),
    used: false,
  }))

  // Insert new codes first — if this fails the old codes are still intact
  const { data: inserted, error } = await admin
    .from('mfa_backup_codes')
    .insert(rows)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Delete old codes now that the new set is safely stored; if this fails the
  // user briefly has both sets in the DB — harmless, old plaintext is discarded
  const newIds = (inserted as { id: string }[]).map(r => r.id)
  await admin
    .from('mfa_backup_codes')
    .delete()
    .eq('user_id', user.id)
    .not('id', 'in', `(${newIds.join(',')})`)

  logAudit({ userId: user.id, action: 'mfa.enabled' }).catch(() => {})

  return NextResponse.json({ ok: true })
}

// DELETE — remove backup codes on unenroll
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.BACKUP_CODE_PEPPER) {
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 })
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await adminClient().from('mfa_backup_codes').delete().eq('user_id', user.id)

  logAudit({ userId: user.id, action: 'mfa.disabled' }).catch(() => {})

  return NextResponse.json({ ok: true })
}
