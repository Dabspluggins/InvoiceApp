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

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('announcement_drafts')
    .select('*')
    .in('status', ['draft', 'scheduled'])
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ drafts: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { subject, body_html, body_text, recipient_mode, recipient_ids, segment_id, status, scheduled_for } = body

  const admin = getAdminClient()
  const { data, error } = await admin
    .from('announcement_drafts')
    .insert({
      subject: subject ?? '',
      body_html: body_html ?? '',
      body_text: body_text ?? '',
      recipient_mode: recipient_mode ?? 'all',
      recipient_ids: recipient_ids ?? [],
      segment_id: segment_id ?? null,
      status: status ?? 'draft',
      scheduled_for: scheduled_for ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ draft: data }, { status: 201 })
}
