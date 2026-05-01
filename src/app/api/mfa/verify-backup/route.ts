import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { logAudit } from '@/lib/audit'
import { backupCodeLimiter } from '@/lib/ratelimit'

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

// POST — verify a backup code, mark used, and unenroll the TOTP factor server-side
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

  const { success } = await backupCodeLimiter.limit(`backup_code_attempt:${user.id}`)
  if (!success) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const { code } = await req.json()
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  const admin = adminClient()
  const codeHash = hashCode(code)

  const { data: row } = await admin
    .from('mfa_backup_codes')
    .select('id')
    .eq('user_id', user.id)
    .eq('code_hash', codeHash)
    .eq('used', false)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ valid: false })
  }

  // Atomically mark used — conditional .eq('used', false) prevents double-consumption
  const { data: consumed } = await admin
    .from('mfa_backup_codes')
    .update({ used: true })
    .eq('id', row.id)
    .eq('used', false)
    .select('id')
    .single()

  if (!consumed) {
    return NextResponse.json({ valid: false })
  }

  // Find and delete the verified TOTP factor via admin REST API
  // (user is at AAL1 so client-side unenroll would be blocked)
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const totpFactor = factors?.totp?.find(f => f.status === 'verified')

  if (totpFactor) {
    const deleteRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${user.id}/factors/${totpFactor.id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
      }
    )
    if (!deleteRes.ok) {
      return NextResponse.json({ error: 'Failed to remove authenticator factor.' }, { status: 500 })
    }
    // Clean up backup codes since 2FA is now gone
    await admin.from('mfa_backup_codes').delete().eq('user_id', user.id)
  }

  logAudit({ userId: user.id, action: 'mfa.disabled', metadata: { reason: 'backup_code_used' } }).catch(() => {})

  return NextResponse.json({ valid: true })
}
