import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { sendAnnouncement } from '@/lib/sendAnnouncement'

const ADMIN_EMAIL = 'enyinnayadaberechi@gmail.com'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('Authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = getAdminClient()
  const { data: drafts, error } = await admin
    .from('announcement_drafts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_for', new Date().toISOString())

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let failed = 0

  for (const draft of drafts ?? []) {
    try {
      const result = await sendAnnouncement({ subject: draft.subject, body: draft.body_text })

      await admin
        .from('announcement_drafts')
        .update({ status: 'sent', updated_at: new Date().toISOString() })
        .eq('id', draft.id)

      await admin.from('announcements').insert({
        title: draft.subject,
        body: draft.body_text,
        sent_by: ADMIN_EMAIL,
        recipient_count: result.sent,
      })

      sent++
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      await admin
        .from('announcement_drafts')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.id)
      failed++
    }
  }

  return NextResponse.json({ sent, failed })
}
