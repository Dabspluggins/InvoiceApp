import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { password, totpCode } = await req.json().catch(() => ({})) as {
    password?: string
    totpCode?: string
  }

  if (!password) {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 })
  }

  // Verify password by re-authenticating
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password,
  })
  if (signInError) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  // Check if the user has a verified TOTP factor
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const totpFactor = factors?.totp?.find(f => f.status === 'verified')

  if (totpFactor) {
    if (!totpCode) {
      return NextResponse.json({ error: 'Two-factor authentication code required.' }, { status: 400 })
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Failed to initiate MFA challenge.' }, { status: 500 })
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code: totpCode,
    })
    if (verifyError) {
      return NextResponse.json({ error: 'Invalid two-factor authentication code.' }, { status: 401 })
    }
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await adminClient.auth.admin.deleteUser(user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
