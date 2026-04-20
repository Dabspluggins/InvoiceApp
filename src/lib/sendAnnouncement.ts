import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

export async function sendAnnouncement({
  subject,
  body,
}: {
  subject: string
  body: string
}): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY

  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    throw new Error('Server misconfigured')
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const resend = new Resend(resendKey)

  const { data: optedIn } = await admin
    .from('profiles')
    .select('id')
    .eq('email_updates', true)

  const optedInIds = new Set((optedIn ?? []).map((p: { id: string }) => p.id))

  const allUsers: Array<{ id: string; email: string; user_metadata: Record<string, unknown> }> = []
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    allUsers.push(...(data.users as typeof allUsers))
    if (data.users.length < 1000) break
    page++
  }

  const recipients = allUsers.filter(u => u.email && optedInIds.has(u.id))
  const skipped = allUsers.length - recipients.length

  let sent = 0
  const errors: string[] = []

  for (const u of recipients) {
    try {
      const firstName = deriveFirstName(u.user_metadata?.full_name as string | undefined, u.email)
      const { html, text } = buildAnnouncementEmail({ firstName, body, userId: u.id })

      const { error: sendError } = await resend.emails.send({
        from: 'Dab from BillByDab <onboarding@billbydab.com>',
        to: u.email,
        subject,
        html,
        text,
        headers: {
          'List-Unsubscribe': `<mailto:unsubscribe@billbydab.com>, <https://billbydab.com/api/unsubscribe?token=${u.id}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })

      if (sendError) {
        errors.push(`${u.email}: ${sendError.message}`)
        continue
      }

      sent++
    } catch (err) {
      errors.push(`${u.email}: ${String(err)}`)
    }
  }

  return { sent, skipped, errors }
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
  body: string
  userId: string
}): { html: string; text: string } {
  const { firstName, body, userId } = opts

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
    <p style="margin:0 0 20px;color:#222222;font-size:15px;line-height:1.75;">Hey ${firstName},</p>
    ${bodyParagraphs}
    <p style="margin:0 0 16px;color:#222222;font-size:15px;line-height:1.75;">
      You can check out what&#39;s new at <a href="https://billbydab.com/dashboard" style="color:#222222;">billbydab.com/dashboard</a>.
    </p>
    <p style="margin:32px 0 0;color:#222222;font-size:15px;line-height:1.8;">
      With love from Lagos,<br>Dab<br>Founder, BillByDab
    </p>
    <p style="margin:48px 0 0;color:#9ca3af;font-size:11px;line-height:1.6;">
      You&#39;re receiving this because you opted in to product updates.
      <a href="https://billbydab.com/api/unsubscribe?token=${userId}" style="color:#9ca3af;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`

  const text = `Hey ${firstName},

${body}

You can check out what's new at https://billbydab.com/dashboard

With love from Lagos,
Dab
Founder, BillByDab

---
You're receiving this because you opted in to product updates.
Unsubscribe: https://billbydab.com/api/unsubscribe?token=${userId}`

  return { html, text }
}
