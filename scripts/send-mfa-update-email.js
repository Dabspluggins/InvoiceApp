// One-time broadcast: notify all BillByDab users that MFA backup codes were reset.
//
// Usage:
//   node scripts/send-mfa-update-email.js --dry-run   # preview recipients, no sends
//   node scripts/send-mfa-update-email.js              # live send
//
// Required env vars (read from .env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY

'use strict'

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const { Resend } = require('resend')

const DRY_RUN = process.argv.includes('--dry-run')
const DELAY_MS = 200
const SUBJECT = 'Action Required: Please Regenerate Your MFA Backup Codes'

const EMAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Action Required: Regenerate Your MFA Backup Codes</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">

  <!-- Preheader text (hidden, shows in inbox preview) -->
  <span style="display:none;font-size:1px;color:#f4f4f7;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Important: Your MFA backup codes have been reset. Please generate a new set to keep your account recoverable.
  </span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">

        <!-- Email container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#4F46E5;padding:32px 40px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">BillByDab</span>
            </td>
          </tr>

          <!-- Alert banner -->
          <tr>
            <td style="background-color:#FEF3C7;padding:14px 40px;border-bottom:1px solid #FDE68A;">
              <p style="margin:0;font-size:13px;color:#92400E;font-weight:600;text-align:center;">
                ⚠️&nbsp; Action Required — Please read before your next login
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">

              <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6;">Hi there,</p>

              <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
                We've just shipped an important security upgrade to <strong>BillByDab</strong> that strengthens how your MFA backup codes are stored and protected.
              </p>

              <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
                As part of this update, <strong>your existing backup codes have been invalidated.</strong> If you use two-factor authentication (2FA), you'll need to generate a new set to keep your account recoverable.
              </p>

              <!-- Steps box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;margin:28px 0;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111827;">How to regenerate your backup codes:</p>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:6px 0;vertical-align:top;">
                          <span style="display:inline-block;width:24px;height:24px;background-color:#4F46E5;color:#ffffff;border-radius:50%;font-size:12px;font-weight:700;text-align:center;line-height:24px;margin-right:12px;">1</span>
                        </td>
                        <td style="padding:6px 0;font-size:15px;color:#374151;line-height:1.5;vertical-align:top;">Log in to your BillByDab account</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;vertical-align:top;">
                          <span style="display:inline-block;width:24px;height:24px;background-color:#4F46E5;color:#ffffff;border-radius:50%;font-size:12px;font-weight:700;text-align:center;line-height:24px;margin-right:12px;">2</span>
                        </td>
                        <td style="padding:6px 0;font-size:15px;color:#374151;line-height:1.5;vertical-align:top;">Go to <strong>Settings → Security</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;vertical-align:top;">
                          <span style="display:inline-block;width:24px;height:24px;background-color:#4F46E5;color:#ffffff;border-radius:50%;font-size:12px;font-weight:700;text-align:center;line-height:24px;margin-right:12px;">3</span>
                        </td>
                        <td style="padding:6px 0;font-size:15px;color:#374151;line-height:1.5;vertical-align:top;">Under Two-Factor Authentication, click <strong>Regenerate Backup Codes</strong></td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;vertical-align:top;">
                          <span style="display:inline-block;width:24px;height:24px;background-color:#4F46E5;color:#ffffff;border-radius:50%;font-size:12px;font-weight:700;text-align:center;line-height:24px;margin-right:12px;">4</span>
                        </td>
                        <td style="padding:6px 0;font-size:15px;color:#374151;line-height:1.5;vertical-align:top;">Save your new codes somewhere safe — a password manager or printed copy works well</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;">
                <tr>
                  <td align="center">
                    <a href="https://www.billbydab.com/settings" style="display:inline-block;background-color:#4F46E5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:6px;letter-spacing:0.2px;">
                      Go to Settings →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Why it matters -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF2FF;border-left:4px solid #4F46E5;border-radius:0 6px 6px 0;margin:0 0 28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#3730A3;">Why does this matter?</p>
                    <p style="margin:0;font-size:14px;color:#4338CA;line-height:1.6;">
                      Backup codes are your safety net if you ever lose access to your authenticator app. Without a valid set, you could be permanently locked out of your account if your device is lost or reset.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:14px;color:#6B7280;line-height:1.6;">
                This only affects users with 2FA enabled. If you haven't set up two-factor authentication, no action is needed on your end.
              </p>

              <p style="margin:0 0 8px;font-size:16px;color:#374151;line-height:1.6;">
                If you run into any issues, simply reply to this email and we'll help you out.
              </p>

              <p style="margin:28px 0 0;font-size:16px;color:#374151;line-height:1.6;">
                Stay secure,<br />
                <strong>Dab</strong><br />
                <span style="color:#6B7280;font-size:14px;">BillByDab</span>
              </p>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#9CA3AF;">
                You're receiving this because you have an account on BillByDab.
              </p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                &copy; 2026 BillByDab &mdash;
                <a href="https://www.billbydab.com" style="color:#6B7280;text-decoration:underline;">billbydab.com</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- End container -->

      </td>
    </tr>
  </table>

</body>
</html>`

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAllUsers(admin) {
  const users = []
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Failed to list users (page ${page}): ${error.message}`)
    users.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }
  return users
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY

  const missing = []
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!resendApiKey) missing.push('RESEND_API_KEY')
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`)
    process.exit(1)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('Fetching users...')
  const users = await fetchAllUsers(admin)
  const emails = users.map((u) => u.email).filter(Boolean)
  console.log(`Found ${emails.length} users with email addresses.`)

  if (DRY_RUN) {
    console.log('\n--- DRY RUN (no emails will be sent) ---')
    for (const email of emails) {
      console.log(`  would send to: ${email}`)
    }
    console.log(`\nDry run complete. ${emails.length} recipients identified.`)
    return
  }

  const resend = new Resend(resendApiKey)
  let sent = 0
  let failed = 0

  for (const email of emails) {
    try {
      const { error } = await resend.emails.send({
        from: 'BillByDab <invoices@billbydab.com>',
        to: [email],
        subject: SUBJECT,
        html: EMAIL_HTML,
      })
      if (error) {
        console.log(`✗ failed: ${email} — ${error.message}`)
        failed++
      } else {
        console.log(`✓ sent to ${email}`)
        sent++
      }
    } catch (err) {
      console.log(`✗ failed: ${email} — ${err.message}`)
      failed++
    }
    await delay(DELAY_MS)
  }

  console.log(`\nDone. ${sent} sent, ${failed} failed.`)
}

main().catch((err) => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
