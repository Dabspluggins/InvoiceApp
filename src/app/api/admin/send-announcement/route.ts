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
  const { title, body: announcementBody } = body as { title?: string; body?: string }

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

  // Fetch opted-in profiles (email_updates = true)
  const { data: optedIn } = await admin
    .from('profiles')
    .select('id')
    .eq('email_updates', true)

  const optedInIds = new Set((optedIn ?? []).map((p: { id: string }) => p.id))
  console.log(`[send-announcement] Opted-in users: ${optedInIds.size}`)

  // Get all auth users (paginated — Supabase returns max 1000 per page)
  const allUsers: Array<{ id: string; email: string; user_metadata: Record<string, unknown> }> = []
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    allUsers.push(...data.users as typeof allUsers)
    if (data.users.length < 1000) break
    page++
  }

  console.log(`[send-announcement] Total auth users: ${allUsers.length}`)

  const recipients = allUsers.filter(u => u.email && optedInIds.has(u.id))
  const skipped = allUsers.length - recipients.length

  console.log(`[send-announcement] Sending to ${recipients.length} recipients, skipping ${skipped}`)

  let sent = 0
  const errors: string[] = []

  for (const u of recipients) {
    try {
      const firstName = deriveFirstName(u.user_metadata?.full_name as string | undefined, u.email)
      const html = buildAnnouncementEmail({ firstName, title: title.trim(), body: announcementBody.trim(), userId: u.id })

      const { error: sendError } = await resend.emails.send({
        from: 'Dab from BillByDab <onboarding@billbydab.com>',
        to: u.email,
        subject: title.trim(),
        html,
      })

      if (sendError) {
        errors.push(`${u.email}: ${sendError.message}`)
        console.error(`[send-announcement] Failed for ${u.email}:`, sendError.message)
        continue
      }

      sent++
      if (sent % 10 === 0) {
        console.log(`[send-announcement] Progress: ${sent}/${recipients.length} sent`)
      }
    } catch (err) {
      errors.push(`${u.email}: ${String(err)}`)
    }
  }

  console.log(`[send-announcement] Done. Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors.length}`)

  // Log to announcements table
  await admin.from('announcements').insert({
    title: title.trim(),
    body: announcementBody.trim(),
    sent_by: ADMIN_EMAIL,
    recipient_count: sent,
  })

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
}): string {
  const { firstName, title, body, userId } = opts
  const year = new Date().getFullYear()

  // Convert body line breaks to paragraphs
  const bodyParagraphs = body
    .split(/\n\n+/)
    .map(para => para.replace(/\n/g, '<br>'))
    .map(para => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.75;">${para}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:580px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.10);">

    <!-- Header -->
    <div style="background:#111827;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">BillByDab</h1>
      <p style="margin:6px 0 0;color:#9ca3af;font-size:14px;">Built in Lagos. Free everywhere.</p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">

      <p style="margin:0 0 20px;color:#111827;font-size:16px;line-height:1.6;">
        Hey ${firstName},
      </p>

      ${bodyParagraphs}

      <!-- CTA Button -->
      <div style="margin:32px 0 36px;">
        <a href="https://billbydab.com/dashboard"
           style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
          See What&#39;s New &#8594;
        </a>
      </div>

      <!-- Signature -->
      <p style="margin:0;color:#374151;font-size:15px;line-height:1.8;">
        With love from Lagos,<br>
        <strong>Dab</strong>
      </p>

    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;border-top:1px solid #f3f4f6;background:#f9fafb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.7;text-align:center;">
        &#169; ${year} BillByDab &#183;
        <a href="https://www.billbydab.com/privacy" style="color:#9ca3af;text-decoration:none;">Privacy Policy</a> &#183;
        <a href="https://billbydab.com/api/unsubscribe?token=${userId}" style="color:#9ca3af;text-decoration:none;">Unsubscribe</a>
      </p>
    </div>

  </div>
</body>
</html>`
}
