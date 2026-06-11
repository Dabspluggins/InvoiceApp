const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))

const checks = []

function check(id, severity, file, vulnerable, evidence) {
  checks.push({ id, severity, file, vulnerable: Boolean(vulnerable), evidence })
}

const cron = read('src/app/api/cron/send-scheduled/route.ts')
const middleware = read('src/middleware.ts')
check(
  'CRON_AUTH_FAIL_OPEN',
  'Critical',
  'src/app/api/cron/send-scheduled/route.ts',
  /if\s*\(cronSecret\)\s*{[\s\S]*Authorization/.test(cron) && middleware.includes("'/api/cron/'"),
  'Auth is only checked inside if (cronSecret), and middleware marks /api/cron/ public.'
)

const sendAnnouncement = read('src/lib/sendAnnouncement.ts')
const adminSend = read('src/app/api/admin/send-announcement/route.ts')
const draftSend = read('src/app/api/admin/drafts/[id]/send/route.ts')

check(
  'ANNOUNCEMENT_GLOBAL_RECIPIENTS',
  'High',
  'src/lib/sendAnnouncement.ts',
  /admin\.auth\.admin\.listUsers/.test(sendAnnouncement) &&
    /email_updates/.test(sendAnnouncement) &&
    !/recipientIds|recipientEmails|segmentId/.test(sendAnnouncement),
  'Helper lists all auth users and filters only by email_updates; no recipient-scope parameter exists.'
)

check(
  'ADMIN_SEND_IGNORES_RECIPIENT_SCOPE',
  'High',
  'src/app/api/admin/send-announcement/route.ts',
  /title/.test(adminSend) &&
    /announcementBody/.test(adminSend) &&
    /sendAnnouncement\(\{\s*subject:\s*title\.trim\(\),\s*body:\s*announcementBody\.trim\(\)\s*\}\)/.test(adminSend) &&
    !/recipientIds|recipientEmails|segmentId/.test(adminSend),
  'Immediate admin send parses only title/body and calls sendAnnouncement.'
)

check(
  'DRAFT_SEND_IGNORES_RECIPIENT_SCOPE',
  'High',
  'src/app/api/admin/drafts/[id]/send/route.ts',
  /sendAnnouncement\(\{\s*subject:\s*draft\.subject,\s*body:\s*draft\.body_text\s*\}\)/.test(draftSend),
  'Draft send passes only subject/body into global helper.'
)

check(
  'SENTRY_EXAMPLE_ROUTES_PRESENT',
  'High',
  'src/app/sentry-example-page/page.tsx',
  exists('src/app/sentry-example-page/page.tsx') || exists('src/app/api/sentry-example-api/route.ts'),
  'Sentry example page/API files are present in the local working tree.'
)

const clients = read('src/app/api/clients/route.ts')
check(
  'PORTAL_TOKEN_64_BIT_PERMANENT',
  'Medium',
  'src/app/api/clients/route.ts',
  /randomUUID\(\)\.replace\(\/-\/g,\s*''\)\.slice\(0,\s*16\)/.test(clients),
  'Portal token is 16 hex chars from UUID text.'
)

const remind = read('src/app/api/invoices/[id]/remind/route.ts')
const clientAction = read('src/app/api/estimates/[id]/client-action/route.ts')

check(
  'EMAIL_HTML_UNESCAPED_REMINDER',
  'Medium',
  'src/app/api/invoices/[id]/remind/route.ts',
  /Hi \$\{clientName\}/.test(remind) || /#\$\{invoiceNumber\}/.test(remind) || /\$\{senderName\}/.test(remind),
  'Reminder email interpolates client/invoice/sender fields into HTML.'
)

check(
  'EMAIL_HTML_UNESCAPED_ESTIMATE_ACTION',
  'Medium',
  'src/app/api/estimates/[id]/client-action/route.ts',
  /\$\{clientName\}/.test(clientAction) && /\$\{estimate\.estimate_number\}/.test(clientAction),
  'Estimate action email interpolates estimate/client fields into HTML.'
)

check(
  'ANNOUNCEMENT_HTML_UNSANITIZED_BODY',
  'Medium',
  'src/lib/sendAnnouncement.ts',
  /bodyParagraphs[\s\S]*para\.replace\(\/\\n\/g,\s*'<br>'\)[\s\S]*\$\{para\}/.test(sendAnnouncement),
  'Announcement body is transformed to HTML paragraphs without escaping/sanitization.'
)

const rate = read('src/app/api/auth/check-rate-limit/route.ts')
const login = read('src/app/auth/login/page.tsx')
check(
  'RATE_LIMIT_PREFLIGHT_CONSUMES_QUOTA',
  'Medium',
  'src/app/api/auth/check-rate-limit/route.ts',
  /limiter\.limit\(ip\)/.test(rate) && /check-rate-limit/.test(login),
  'Unauthenticated preflight endpoint consumes limiter quota before actual Supabase auth.'
)

const utils = read('src/lib/utils.ts')
check(
  'IP_HEADER_TRUST_ASSUMPTION',
  'Medium',
  'src/lib/utils.ts',
  /x-forwarded-for/.test(utils) && /parts\[parts\.length - 1\]/.test(utils),
  'Trusted IP is derived from X-Forwarded-For last hop when request.ip is absent.'
)

const nextConfig = read('next.config.ts')
check(
  'MISSING_SECURITY_HEADERS',
  'Medium',
  'next.config.ts',
  !/headers\s*\(/.test(nextConfig) &&
    !/Content-Security-Policy|Strict-Transport-Security|X-Frame-Options/.test(nextConfig),
  'Next config does not define security headers.'
)

const gitignore = read('.gitignore')
check(
  'SUPABASE_TEMP_NOT_IGNORED_OR_PRESENT',
  'Low',
  '.gitignore',
  exists('supabase/.temp') && !/supabase\/\.temp|supabase\\\.temp|\.temp\//.test(gitignore),
  'supabase/.temp exists and no explicit ignore pattern was found.'
)

console.table(checks.map(({ id, severity, vulnerable, file }) => ({ id, severity, vulnerable, file })))

const confirmed = checks.filter((c) => c.vulnerable)
console.log(`\nConfirmed by read-only probes: ${confirmed.length} of ${checks.length}`)
for (const c of confirmed) {
  console.log(`- [${c.severity}] ${c.id}: ${c.evidence}`)
}

process.exit(confirmed.length ? 2 : 0)
