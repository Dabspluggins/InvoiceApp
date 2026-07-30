import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { sendAnnouncement } from '@/lib/sendAnnouncement'

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = getAdminClient()

  const { data: draft, error: fetchError } = await admin
    .from('announcement_drafts')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  try {
    const result = await sendAnnouncement({ subject: draft.subject, body: draft.body_text })

    await admin
      .from('announcement_drafts')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', id)

    await admin.from('announcements').insert({
      title: draft.subject,
      body: draft.body_text,
      sent_by: ADMIN_EMAIL,
      recipient_count: result.sent,
    })

    return NextResponse.json({ sent: result.sent, skipped: result.skipped })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await admin
      .from('announcement_drafts')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
