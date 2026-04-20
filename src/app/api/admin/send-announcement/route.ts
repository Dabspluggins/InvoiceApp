import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { announcementLimiter } from '@/lib/ratelimit'
import { sendAnnouncement } from '@/lib/sendAnnouncement'

const ADMIN_EMAIL = 'enyinnayadaberechi@gmail.com'

export async function POST(request: NextRequest) {
  console.log('[send-announcement] Request received')

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { success, reset } = await announcementLimiter.limit(user.id)
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter },
      { status: 429 }
    )
  }

  const body = await request.json()
  const { title, body: announcementBody } = body as { title?: string; body?: string }

  if (!title?.trim() || !announcementBody?.trim()) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  try {
    const result = await sendAnnouncement({ subject: title.trim(), body: announcementBody.trim() })

    console.log(`[send-announcement] Done. Sent: ${result.sent}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`)

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    await admin.from('announcements').insert({
      title: title.trim(),
      body: announcementBody.trim(),
      sent_by: ADMIN_EMAIL,
      recipient_count: result.sent,
    })

    return NextResponse.json({
      sent: result.sent,
      skipped: result.skipped,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (err) {
    console.error('[send-announcement] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Send failed' },
      { status: 500 }
    )
  }
}
