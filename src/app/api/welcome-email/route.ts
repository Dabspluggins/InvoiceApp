/**
 * POST /api/welcome-email
 *
 * Sends a one-time welcome email to a newly confirmed user.
 * Called from DashboardShell on first visit after signup — cookies are fully set
 * at that point, so standard cookie-based auth works reliably.
 *
 * SQL required (run once in Supabase):
 *   ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_sent BOOLEAN DEFAULT false;
 */
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logger'

function buildWelcomeEmailHtml(firstName: string, year: number): string {
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
      <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Vortali</h1>
      <p style="margin:6px 0 0;color:#9ca3af;font-size:14px;">Built in Lagos. Free everywhere.</p>
    </div>

    <!-- Body -->
    <div style="padding:40px;">

      <p style="margin:0 0 20px;color:#111827;font-size:16px;line-height:1.6;">
        Hey ${firstName},
      </p>

      <p style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:700;line-height:1.5;">
        Someone built Vortali for you.
      </p>

      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.75;">
        Too many freelancers and business owners were building invoices in Word, chasing clients on WhatsApp, and tracking payments in their heads. That&#39;s not a system &#8212; that&#39;s survival mode.
      </p>

      <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75;">
        We built something better. And we kept it free &#8212; because the people who need it most are the ones who can least afford another subscription.
      </p>

      <!-- Divider -->
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 28px;">

      <p style="margin:0 0 20px;color:#111827;font-size:15px;font-weight:600;line-height:1.5;">
        Here&#39;s what makes Vortali different:
      </p>

      <!-- Feature card: Price Negotiation -->
      <div style="border-left:4px solid #4F46E5;background:#f5f3ff;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;">
        <p style="margin:0 0 6px;color:#4F46E5;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Price Negotiation on Estimates</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
          Send a price proposal and let clients negotiate within a range you control. They can remove items or propose lower prices &#8212; you see their offer and decide to accept, reject, or convert directly to invoice. No other free invoicing tool does this.
        </p>
      </div>

      <!-- Feature card: WhatsApp-native -->
      <div style="border-left:4px solid #16a34a;background:#f0fdf4;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;">
        <p style="margin:0 0 6px;color:#16a34a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">WhatsApp-Native</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
          Send invoices and estimates via WhatsApp in one click. Your client gets a link, reviews everything in a clean portal, and you&#39;re notified the moment they open it. Meet your clients where they already are.
        </p>
      </div>

      <!-- Feature card: Client Credit -->
      <div style="border-left:4px solid #ea580c;background:#fff7ed;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 28px;">
        <p style="margin:0 0 6px;color:#ea580c;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Client Credit</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">
          When a client overpays, record the excess as credit in their favour. Next invoice, it&#39;s automatically available to apply &#8212; no awkward conversations, no mental math.
        </p>
      </div>

      <p style="margin:0 0 32px;color:#6b7280;font-size:14px;line-height:1.7;">
        There&#39;s more &#8212; analytics, expense tracking, recurring invoices, client management, invoice templates. All free.
      </p>

      <!-- CTA Button -->
      <div style="margin:0 0 36px;">
        <a href="https://www.vortali.com/invoice"
           style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
          Send your first invoice &#8594;
        </a>
      </div>

      <!-- Bridge line -->
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.75;font-style:italic;">
        One last thing before you go &#8212;
      </p>

      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.75;">
        I&#39;m genuinely glad you&#39;re here. If you ever get stuck or have a question, just reply to this email. I read every message.
      </p>

      <p style="margin:0 0 32px;color:#374151;font-size:15px;line-height:1.75;">
        Let&#39;s get you paid.
      </p>

      <!-- Signature -->
      <p style="margin:0;color:#111827;font-size:15px;line-height:1.8;">
        <strong>Dab</strong><br>
        <span style="color:#6b7280;font-size:13px;">Founder, Vortali &#183; Built in Lagos</span><br>
        <a href="mailto:onboarding@vortali.com" style="color:#6b7280;font-size:13px;text-decoration:none;">onboarding@vortali.com</a>
      </p>

    </div>

    <!-- Footer -->
    <div style="padding:24px 40px;border-top:1px solid #f3f4f6;background:#f9fafb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.7;text-align:center;">
        You&#39;re receiving this because you just created an account at
        <a href="https://www.vortali.com" style="color:#4F46E5;text-decoration:none;">vortali.com</a>.<br>
        &#169; ${year} Vortali &#183;
        <a href="https://www.vortali.com/privacy" style="color:#9ca3af;text-decoration:none;">Privacy Policy</a> &#183;
        <a href="https://www.vortali.com/terms" style="color:#9ca3af;text-decoration:none;">Terms</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
    }

    // --- Atomic claim ---
    // Try to flip welcome_sent from false → true on an existing profile row.
    // Only the request that wins this UPDATE proceeds to send.
    const { data: updated } = await supabase
      .from('profiles')
      .update({ welcome_sent: true })
      .eq('id', user.id)
      .eq('welcome_sent', false)
      .select('id')

    const didClaim = updated && updated.length > 0

    if (!didClaim) {
      // No existing row with welcome_sent = false.
      // Either (a) welcome_sent is already true → skip, or
      // (b) no profile row exists yet → try to insert one.
      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert({ id: user.id, welcome_sent: true })
        .select('id')

      // Conflict (23505) means the row now exists with welcome_sent = true → already sent
      if (insertError || !inserted || inserted.length === 0) {
        return NextResponse.json({ skipped: true })
      }
      // Fell through — new profile row created, proceed to send
    }

    // --- Send email ---
    const resend = new Resend(apiKey)

    // Extract first name from email prefix (e.g. john.doe@... → John)
    const emailPrefix = user.email.split('@')[0]
    const firstName =
      emailPrefix
        .split(/[._-]/)[0]
        .replace(/[^a-zA-Z]/g, '')
        .replace(/^./, (c) => c.toUpperCase()) || 'there'

    const year = new Date().getFullYear()
    const html = buildWelcomeEmailHtml(firstName, year)

    const { error: sendError } = await resend.emails.send({
      from: 'Dab from Vortali <onboarding@vortali.com>',
      to: [user.email],
      subject: "Welcome to Vortali — let's get you paid",
      html,
    })

    if (sendError) {
      logError('welcome-email', 'send', { userId: user.id }, sendError)
      return NextResponse.json({ error: sendError.message }, { status: 500 })
    }

    return NextResponse.json({ sent: true })
  } catch (err) {
    logError('welcome-email', 'send', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
