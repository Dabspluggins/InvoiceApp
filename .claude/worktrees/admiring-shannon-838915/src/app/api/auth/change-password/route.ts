import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/audit'
import { changePasswordLimiter } from '@/lib/ratelimit'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await changePasswordLimiter.limit(user.id)
  if (!success) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const { currentPassword, newPassword, totpCode } = await req.json()

  if (!currentPassword || typeof currentPassword !== 'string') {
    return NextResponse.json({ error: 'Current password is required.' }, { status: 400 })
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 12) {
    return NextResponse.json({ error: 'New password must be at least 12 characters.' }, { status: 400 })
  }

  // Verify current password
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email ?? '',
    password: currentPassword,
  })
  if (signInError) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 })
  }

  // If the user has a verified TOTP factor, a valid authenticator code is required
  const { data: factorsData } = await supabase.auth.mfa.listFactors()
  const totpFactor = factorsData?.totp?.find(f => f.status === 'verified')

  if (totpFactor) {
    if (!totpCode || typeof totpCode !== 'string') {
      return NextResponse.json(
        { error: 'Authenticator code is required.', totpRequired: true },
        { status: 403 }
      )
    }
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: totpFactor.id,
      code: totpCode,
    })
    if (mfaError) {
      return NextResponse.json({ error: 'Invalid authenticator code.' }, { status: 403 })
    }
  }

  // All checks passed — update via service role so the change is authoritative
  const { error: updateError } = await adminClient().auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  logAudit({ userId: user.id, action: 'password.changed' }).catch(() => {})
  return NextResponse.json({ ok: true })
}
