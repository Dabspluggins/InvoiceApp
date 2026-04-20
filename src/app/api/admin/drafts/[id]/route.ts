import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = 'enyinnayadaberechi@gmail.com'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  if (user.email !== ADMIN_EMAIL) return null
  return user
}

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { subject, body_html, body_text, recipient_mode, recipient_ids, segment_id, status, scheduled_for } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (subject !== undefined) updates.subject = subject
  if (body_html !== undefined) updates.body_html = body_html
  if (body_text !== undefined) updates.body_text = body_text
  if (recipient_mode !== undefined) updates.recipient_mode = recipient_mode
  if (recipient_ids !== undefined) updates.recipient_ids = recipient_ids
  if (segment_id !== undefined) updates.segment_id = segment_id
  if (status !== undefined) updates.status = status
  if (scheduled_for !== undefined) updates.scheduled_for = scheduled_for

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('announcement_drafts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ draft: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = getAdminClient()
  const { error } = await admin
    .from('announcement_drafts')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
