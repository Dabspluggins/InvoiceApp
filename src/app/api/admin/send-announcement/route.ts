import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { announcementLimiter } from '@/lib/ratelimit'

const ADMIN_EMAIL = 'enyinnayadaberechi@gmail.com'

export async function POST(request: NextRequest) {
  console.log('[send-announcement] Request received')

  // Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.log('[send-announcement] Unauthorized — no session')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.email !== ADMIN_EMAIL) {
    console.log('[send-announcement] Forbidden — not admin:', user.email)
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
  const {
    title,
    body: announcementBody,
    recipientIds,
    recipientEmails,
  } = body as {
    title?: string
    body?: string
    recipientIds?: string[]
    recipientEmails?: string[]
  }

  if (!title?.trim() || !announcementBody?.trim()) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY

  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const resend = new Resend(resendKey)

  type AuthUser = { id: string; email: string; user_metadata: Record<string, unknown> }

  let recipients: AuthUser[]
  let skipped = 0

  const isTargeted = Array.isArray(recipientIds) && recipientIds.length > 0
  const isEmailTargeted = !isTargeted && Array.isArray(recipientEmails) && recipientEmails.length > 0

  if (isTargeted) {
    const fetches = await Promise.all(
      recipientIds.map(id => admin.auth.admin.getUserById(id))
    )
    recipients = fetches
      .filter(r => !r.error && r.data?.user?.email)
      .map(r => r.data.user as AuthUser)
    console.log(`[send-announcement] Targeted send to ${recipients.length} specified users`)
  } else {
    const { data: optedIn } = await admin
      .from('profiles')
      .select('id')
      .eq('email_updates', true)

    const optedInIds = new Set((optedIn ?? []).map((p: { id: string }) => p.id))
    console.log(`[send-announcement] Opted-in users: ${optedInIds.size}`)

    const allUsers: AuthUser[] = []
    let page = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !data?.users?.length) break
      allUsers.push(...(data.users as AuthUser[]))
      if (data.users.length < 1000) break
      page++
    }

    console.log(`[send-announcement] Total auth users: ${allUsers.length}`)

    if (isEmailTargeted) {
      const emailSet = new Set(recipientEmails.map((e: string) => e.toLowerCase().trim()))
      recipients = allUsers.filter(u => u.email && emailSet.has(u.email.toLowerCase()) && optedInIds.has(u.id))
    } else {
      recipients = allUsers.filter(u => u.email && optedInIds.has(u.id))
    }
    skipped = allUsers.length - recipients.length
    console.log(`[send-announcement] Sending to ${recipients.length} recipients, skipping ${skipped}`)
  }

  const audienceType = (isTargeted || isEmailTargeted) ? 'specific' : 'all'

  let sent = 0
  const errors: string[] = []
  const sentRecipients: Array<{ email: string; resendId: string }> = []

  for (const u of recipients) {
    try {
      const firstName = deriveFirstName(u.user_metadata?.full_name as string | undefined, u.email)
      const { html, text } = buildAnnouncementEmail({ firstName, title: title.trim(), body: announcementBody.trim(), userId: u.id })

      const { data: sendData, error: sendError } = await resend.emails.send({
        from: 'Dab from BillByDab <onboarding@billbydab.com>',
        to: u.email,
        subject: title.trim(),
        html,
        text,
        headers: {
          'List-Unsubscribe': `<mailto:unsubscribe@billbydab.com>, <https://billbydab.com/api/unsubscribe?token=${u.id}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })

      if (sendError) {
        errors.push(`${u.email}: ${sendError.message}`)
        console.error(`[send-announcement] Failed for ${u.email}:`, sendError.message)
        continue
      }

      sent++
      if (sendData?.id) {
        sentRecipients.push({ email: u.email, resendId: sendData.id })
      }
      if (sent % 10 === 0) {
        console.log(`[send-announcement] Progress: ${sent}/${recipients.length} sent`)
      }
    } catch (err) {
      errors.push(`${u.email}: ${String(err)}`)
    }
  }

  console.log(`[send-announcement] Done. Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors.length}`)

  // Legacy log
  await admin.from('announcements').insert({
    title: title.trim(),
    body: announcementBody.trim(),
    sent_by: ADMIN_EMAIL,
    recipient_count: sent,
  })

  // Analytics log
  if (sent > 0) {
    const { data: logRow, error: logError } = await admin
      .from('announcement_logs')
      .insert({
        subject: title.trim(),
        body_preview: announcementBody.trim().slice(0, 200),
        recipient_count: sent,
        audience_type: audienceType,
        sent_by: user.email,
      })
      .select('id')
      .single()

    if (!logError && logRow?.id && sentRecipients.length > 0) {
      await admin.from('announcement_recipients').insert(
        sentRecipients.map(r => ({
          announcement_id: logRow.id,
          resend_email_id: r.resendId,
          recipient_email: r.email,
        }))
      )
    }
  }

  return NextResponse.json({ sent, skipped, errors: errors.length > 0 ? errors : undefined })
}

function deriveFirstName(fullName: string | undefined, email: string): string {
  if (fullName?.trim()) {
    return fullName.trim().split(/\s+/)[0]
  }
  const prefix = email.split('@')[0]
  const raw = prefix.replace(/[._-]/g, ' ').split(' ')[0]
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function buildAnnouncementEmail(opts: {
  firstName: string
  title: string
  body: string
  userId: string
}): { html: string; text: string } {
  const { firstName, body, userId } = opts

  // Convert body line breaks to HTML paragraphs
  const bodyParagraphs = body
    .split(/\n\n+/)
    .map(para => para.replace(/\n/g, '<br>'))
    .map(para => `<p style="margin:0 0 16px;color:#222222;font-size:15px;line-height:1.75;">${para}</p>`)
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:580px;margin:40px auto;padding:0 24px;">

    <p style="margin:0 0 20px;color:#222222;font-size:15px;line-height:1.75;">
      Hey ${firstName},
    </p>

    ${bodyParagraphs}

    <p style="margin:0 0 16px;color:#222222;font-size:15px;line-height:1.75;">
      You can check out what&#39;s new at <a href="https://billbydab.com/dashboard" style="color:#222222;">billbydab.com/dashboard</a>.
    </p>

    <p style="margin:32px 0 0;color:#222222;font-size:15px;line-height:1.8;">
      With love from Lagos,<br>
      Dab<br>
      Founder, BillByDab
    </p>

    <p style="margin:48px 0 0;color:#9ca3af;font-size:11px;line-height:1.6;">
      You&#39;re receiving this because you opted in to product updates.
      <a href="https://billbydab.com/api/unsubscribe?token=${userId}" style="color:#9ca3af;">Unsubscribe</a>
    </p>

  </div>
</body>
</html>`

  // Plain-text version
  const textBody = body.replace(/\n/g, '\n')
  const text = `Hey ${firstName},

${textBody}

You can check out what's new at https://billbydab.com/dashboard

With love from Lagos,
Dab
Founder, BillByDab

---
You're receiving this because you opted in to product updates.
Unsubscribe: https://billbydab.com/api/unsubscribe?token=${userId}`

  return { html, text }
}
