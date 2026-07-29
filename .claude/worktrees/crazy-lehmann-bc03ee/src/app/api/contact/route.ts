import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { contactLimiter } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const { success, reset } = await contactLimiter.limit(ip)
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter },
      { status: 429 }
    )
  }

  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
    }

    const body = await req.json()
    const { name, email, subject, message } = body as {
      name?: string
      email?: string
      subject?: string
      message?: string
    }

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    const resend = new Resend(apiKey)

    const notifyHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Contact Form</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#4F46E5;padding:32px 40px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">New Contact Form Submission</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px 40px;border-radius:0 0 12px 12px;">
            <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:500;width:140px;border-bottom:1px solid #e5e7eb;">Name</td>
                <td style="padding:12px 16px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">${name}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:500;border-bottom:1px solid #e5e7eb;">Email</td>
                <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;"><a href="mailto:${email}" style="color:#4F46E5;font-size:13px;">${email}</a></td>
              </tr>
              <tr style="background:#f9fafb;">
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:500;border-bottom:1px solid #e5e7eb;">Subject</td>
                <td style="padding:12px 16px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #e5e7eb;">${subject}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#6b7280;font-size:13px;font-weight:500;vertical-align:top;">Message</td>
                <td style="padding:12px 16px;color:#374151;font-size:13px;line-height:1.6;">${message.replace(/\n/g, '<br>')}</td>
              </tr>
            </table>
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Sent via BillByDab Contact Form</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    const autoReplyHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>We received your message</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:#4F46E5;padding:32px 40px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">BillByDab</h1>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px 40px;border-radius:0 0 12px 12px;">
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">Hi ${name},</p>
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              Thanks for reaching out to BillByDab. We've received your message and will respond within 24 hours.
            </p>
            <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
              In the meantime, you can visit our <a href="https://www.billbydab.com/support" style="color:#4F46E5;text-decoration:none;">Help &amp; Support</a> page for answers to common questions.
            </p>
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">— The BillByDab Team</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 40px;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">This is an automated confirmation from <strong style="color:#6b7280;">BillByDab</strong></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    // Send notification to support inbox
    const { error: notifyError } = await resend.emails.send({
      from: 'BillByDab <invoices@billbydab.com>',
      to: ['support@billbydab.com'],
      replyTo: email,
      subject: `[BillByDab Contact] ${subject} — from ${name}`,
      html: notifyHtml,
    })

    if (notifyError) {
      console.error('Resend notify error:', notifyError)
      return NextResponse.json({ error: notifyError.message }, { status: 500 })
    }

    // Send auto-reply to the user
    await resend.emails.send({
      from: 'BillByDab Support <invoices@billbydab.com>',
      to: [email],
      subject: `We've received your message — BillByDab`,
      html: autoReplyHtml,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('contact route error:', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
