import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { logAudit } from '@/lib/audit'
import { backupCodeLimiter } from '@/lib/ratelimit'

function hashCode(code: string) {
  return createHash('sha256').update(code.toUpperCase().replace(/-/g, '').trim()).digest('hex')
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
    .select('id, used')
    .eq('user_id', user.id)
    .eq('code_hash', codeHash)
    .maybeSingle()

  if (!row || row.used) {
    return NextResponse.json({ valid: false })
  }

  // Mark used
  await admin.from('mfa_backup_codes').update({ used: true }).eq('id', row.id)

  // Find and delete the verified TOTP factor via admin REST API
  // (user is at AAL1 so client-side unenroll would be blocked)
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const totpFactor = factors?.totp?.find(f => f.status === 'verified')

  if (totpFactor) {
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${user.id}/factors/${totpFactor.id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
      }
    )
    // Clean up backup codes since 2FA is now gone
    await admin.from('mfa_backup_codes').delete().eq('user_id', user.id)
  }

  logAudit({ userId: user.id, action: 'mfa.disabled', metadata: { reason: 'backup_code_used' } }).catch(() => {})

  return NextResponse.json({ valid: true })
}
