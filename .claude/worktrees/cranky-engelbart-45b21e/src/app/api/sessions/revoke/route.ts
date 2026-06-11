import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { sessionId?: string; password?: string; totpCode?: string }
  const { sessionId, password, totpCode } = body

  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  // Verify identity
  if (totpCode) {
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const factor = (factors?.totp ?? []).find(f => f.status === 'verified')
    if (!factor) return NextResponse.json({ error: 'No verified MFA factor found' }, { status: 400 })
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totpCode })
    if (error) return NextResponse.json({ error: 'Invalid authenticator code' }, { status: 403 })
  } else if (password) {
    if (!user.email) return NextResponse.json({ error: 'No email on account' }, { status: 400 })
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password })
    if (error) return NextResponse.json({ error: 'Incorrect password' }, { status: 403 })
  } else {
    return NextResponse.json({ error: 'Password or TOTP code required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify session belongs to this user before deleting
  const { data: existing } = await admin
    .from('user_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  await admin.from('user_sessions').delete().eq('id', sessionId)

  return NextResponse.json({ ok: true })
}
