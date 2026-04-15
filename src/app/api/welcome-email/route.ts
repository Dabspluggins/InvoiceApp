/**
 * POST /api/welcome-email
 *
 * Sends a one-time welcome email to a newly confirmed user.
 * Called from the client-side auth callback after session is established.
 *
 * SQL required (run once in Supabase):
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_sent BOOLEAN DEFAULT false;
 */
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

function buildWelcomeEmailHtml(firstName: string, year: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#4F46E5;padding:32px 40px;">
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">BillByDab</h1>
      <p style="margin:6px 0 0;color:#c7d2fe;font-size:14px;">Free invoicing for freelancers &amp; small businesses</p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <p style="margin:0 0 16px;color:#111827;font-size:16px;line-height:1.6;">
        Hey ${firstName} &#128075;
      </p>
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">
        Welcome to BillByDab. I&#39;m genuinely glad you&#39;re here.
      </p>
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7;">
        Whether you&#39;re a freelancer chasing payments, a small business owner keeping things tidy, or just someone tired of creating invoices in Word &#8212; this is for you. BillByDab is free, always.
      </p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.7;">
        You can create your first invoice right now &#8212; it takes about 60 seconds. Add your client, line items, and send. That&#39;s it.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="https://www.billbydab.com/invoice"
           style="display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
          Create your first invoice &#8594;
        </a>
      </div>

      <!-- Quick tips -->
      <div style="background:#f5f3ff;border-radius:8px;padding:20px 24px;margin:24px 0;">
        <p style="margin:0 0 12px;color:#4F46E5;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">A few things worth knowing</p>
        <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">&#128196; <strong>Invoices</strong> &#8212; create, send via email or WhatsApp, track payments</p>
        <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">&#128203; <strong>Estimates</strong> &#8212; send price proposals clients can review and negotiate</p>
        <p style="margin:0 0 8px;color:#374151;font-size:14px;line-height:1.6;">&#128101; <strong>Clients</strong> &#8212; save client details for faster invoicing</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">&#128202; <strong>Analytics</strong> &#8212; see what you&#39;ve earned, what&#39;s outstanding, what&#39;s overdue</p>
      </div>

      <p style="margin:24px 0 8px;color:#374151;font-size:15px;line-height:1.7;">
        If you ever get stuck or have a question, just reply to this email. I read every message.
      </p>
      <p style="margin:0 0 32px;color:#374151;font-size:15px;line-height:1.7;">
        Let&#39;s get you paid.
      </p>

      <p style="margin:0;color:#374151;font-size:15px;">
        Warm regards,<br>
        <strong>Dab</strong><br>
        <span style="color:#6b7280;font-size:13px;">Founder, BillByDab</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;border-top:1px solid #f3f4f6;background:#f9fafb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;text-align:center;">
        You&#39;re receiving this because you just signed up at
        <a href="https://www.billbydab.com" style="color:#4F46E5;text-decoration:none;">billbydab.com</a>.<br>
        &#169; ${year} BillByDab &#183; <a href="https://www.billbydab.com/privacy" style="color:#9ca3af;">Privacy Policy</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if welcome email already sent to avoid duplicates
    const { data: profile } = await supabase
      .from('profiles')
      .select('welcome_sent')
      .eq('id', user.id)
      .single()

    if (profile?.welcome_sent) {
      return NextResponse.json({ skipped: true })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
    }

    const resend = new Resend(apiKey)

    // Extract first name from email prefix (e.g. john.doe@... → John)
    const emailPrefix = user.email.split('@')[0]
    const rawFirst = emailPrefix.replace(/[._-]/g, ' ').split(' ')[0]
    const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1)
    const year = new Date().getFullYear()

    const html = buildWelcomeEmailHtml(firstName, year)

    const { error: sendError } = await resend.emails.send({
      from: 'Dab from BillByDab <onboarding@billbydab.com>',
      to: user.email,
      subject: "You're in — let's get your first invoice out 🎉",
      html,
    })

    if (sendError) {
      console.error('Resend error:', sendError)
      return NextResponse.json({ error: sendError.message }, { status: 500 })
    }

    // Mark as sent so we never send it twice
    await supabase
      .from('profiles')
      .upsert({ id: user.id, welcome_sent: true }, { onConflict: 'id' })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Welcome email error:', err)
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 })
  }
}
