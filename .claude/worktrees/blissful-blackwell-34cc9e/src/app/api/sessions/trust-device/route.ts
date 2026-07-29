import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/audit'
import { logError } from '@/lib/logger'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { deviceFingerprint, label } = await request.json() as {
    deviceFingerprint: string
    label?: string
  }

  if (!deviceFingerprint) {
    return NextResponse.json({ error: 'deviceFingerprint is required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin
    .from('trusted_devices')
    .upsert(
      { user_id: user.id, device_fingerprint: deviceFingerprint, label: label ?? null },
      { onConflict: 'user_id,device_fingerprint' }
    )

  if (error) {
    logError('sessions/trust-device', 'Device trust upsert failed', { userId: user?.id ?? 'unknown' }, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logAudit({ userId: user.id, action: 'device.trusted', metadata: { label } }).catch(e => logError('sessions/trust-device', 'Audit log failed', { userId: user?.id ?? 'unknown' }, e))

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json() as { id: string }

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error } = await admin
    .from('trusted_devices')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    logError('sessions/trust-device', 'Device trust delete failed', { userId: user?.id ?? 'unknown' }, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logAudit({ userId: user.id, action: 'device.untrusted' }).catch(e => logError('sessions/trust-device', 'Audit log failed', { userId: user?.id ?? 'unknown' }, e))

  return NextResponse.json({ ok: true })
}
