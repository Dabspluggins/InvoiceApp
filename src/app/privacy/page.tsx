import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — BillByDab',
  description:
    'Learn how BillByDab collects, uses, and protects your personal data when you use our free invoice generation service.',
}

export default function PrivacyPage() {
  return (
    <main className="bg-white dark:bg-gray-900 min-h-screen">
      {/* Page header */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 py-12">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-2">Legal</p>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Privacy Policy</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Effective date: April 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="prose prose-gray max-w-none">

          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-10">
            BillByDab (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates{' '}
            <span className="font-medium text-gray-800">billbydab.com</span>. This Privacy Policy
            explains what information we collect when you use our free invoice generation service,
            how we use it, and the choices you have. By using BillByDab you agree to the practices
            described below.
          </p>

          <Section title="1. Information We Collect">
            <p className="text-gray-600 leading-relaxed mb-4">
              We collect only the data necessary to provide the service.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>
                <span className="font-medium text-gray-800">Account information</span> — your name,
                email address, and business name when you sign up.
              </li>
              <li>
                <span className="font-medium text-gray-800">Business profile data</span> — business
                logo uploads, address, and payment details you choose to save to your profile.
              </li>
              <li>
                <span className="font-medium text-gray-800">Invoice data</span> — line items,
                amounts, due dates, and client details (name, email, address) you enter when
                creating invoices.
              </li>
              <li>
                <span className="font-medium text-gray-800">Technical information</span> — IP
                address, browser type, and operating system collected automatically when you visit
                the site. We use this solely for security and service reliability.
              </li>
              <li>
                <span className="font-medium text-gray-800">Session data</span> — authentication
                tokens stored in cookies to keep you logged in (see Cookies below).
              </li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>To create and manage your account and invoices.</li>
              <li>
                To send transactional emails — such as invoice delivery and payment reminders — via
                our email provider Resend.
              </li>
              <li>To display your business name, logo, and payment details on generated invoices.</li>
              <li>To maintain the security and performance of the platform.</li>
              <li>
                To respond to support requests when you contact us at{' '}
                <a href="mailto:support@billbydab.com" className="text-indigo-600 hover:underline">
                  support@billbydab.com
                </a>
                .
              </li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              We do <strong>not</strong> sell your data, use it for advertising, or share it with
              third parties beyond those listed in this policy.
            </p>
          </Section>

          <Section title="3. Data Storage">
            <p className="text-gray-600 leading-relaxed mb-4">
              Your account data, invoice records, and profile information are stored in a
              PostgreSQL database hosted by{' '}
              <span className="font-medium text-gray-800">Supabase</span>. Business logos and any
              other uploaded images are stored in{' '}
              <span className="font-medium text-gray-800">Supabase Storage</span>. Supabase
              operates servers in the EU and US. For current region information, refer to{' '}
              <a
                href="https://supabase.com/docs/guides/platform/regions"
                className="text-indigo-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Supabase&apos;s region documentation
              </a>
              .
            </p>
          </Section>

          <Section title="4. Third-Party Services">
            <p className="text-gray-600 leading-relaxed mb-4">
              We use the following third-party providers to operate BillByDab:
            </p>
            <div className="space-y-4">
              <ThirdParty
                name="Supabase"
                url="https://supabase.com/privacy"
                description="Authentication, database, and file storage. Supabase processes your account credentials and all stored invoice data."
              />
              <ThirdParty
                name="Resend"
                url="https://resend.com/privacy"
                description="Transactional email delivery. Resend receives the recipient email address and invoice content required to send each email."
              />
              <ThirdParty
                name="Vercel"
                url="https://vercel.com/legal/privacy-policy"
                description="Application hosting and edge network. Vercel processes HTTP request data including IP addresses."
              />
            </div>
            <p className="text-gray-600 leading-relaxed mt-4">
              Each provider has its own privacy policy governing how they handle data. We encourage
              you to review them via the links above.
            </p>
          </Section>

          <Section title="5. Cookies">
            <p className="text-gray-600 leading-relaxed">
              BillByDab uses a single session cookie to keep you authenticated. This cookie is
              strictly necessary for the service to function and does not track your behaviour
              across other websites. We do <strong>not</strong> use advertising cookies, analytics
              cookies, or any form of cross-site tracking.
            </p>
          </Section>

          <Section title="6. Your Rights">
            <p className="text-gray-600 leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li><strong>Access</strong> the personal data we hold about you.</li>
              <li><strong>Correct</strong> inaccurate or incomplete information.</li>
              <li>
                <strong>Delete</strong> your account and associated data (see Data Retention
                below).
              </li>
              <li>
                <strong>Export</strong> your invoice data — you can download any invoice as a PDF
                at any time from your dashboard.
              </li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              To exercise any of these rights, email us at{' '}
              <a href="mailto:support@billbydab.com" className="text-indigo-600 hover:underline">
                support@billbydab.com
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section title="7. Data Retention">
            <p className="text-gray-600 leading-relaxed">
              We retain your data for as long as your account is active. If you request account
              deletion, we will permanently delete your personal data, invoices, and uploaded files
              within <strong>30 days</strong> of receiving your request. Anonymised or aggregated
              data that cannot identify you may be retained for service improvement purposes.
            </p>
          </Section>

          <Section title="8. Children">
            <p className="text-gray-600 leading-relaxed">
              BillByDab is not intended for use by anyone under the age of 13. We do not knowingly
              collect personal data from children. If you believe a child has provided us with
              personal information, please contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p className="text-gray-600 leading-relaxed">
              We may update this Privacy Policy from time to time. When we do, we will revise the
              effective date at the top of this page. For material changes we will notify you by
              email or via an in-app notice. Your continued use of BillByDab after the changes take
              effect constitutes your acceptance of the revised policy.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p className="text-gray-600 leading-relaxed">
              If you have questions or concerns about this Privacy Policy or how we handle your
              data, please contact us at{' '}
              <a href="mailto:support@billbydab.com" className="text-indigo-600 hover:underline">
                support@billbydab.com
              </a>
              .
            </p>
          </Section>

        </div>

        <div className="mt-14 pt-8 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="text-indigo-600 hover:underline font-medium">
            ← Back to BillByDab
          </Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-indigo-600 transition-colors">
            Terms of Service
          </Link>
        </div>
      </div>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      {children}
    </section>
  )
}

function ThirdParty({
  name,
  url,
  description,
}: {
  name: string
  url: string
  description: string
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-gray-800 dark:text-gray-200">{name}</span>
        <a
          href={url}
          className="text-xs text-indigo-600 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy ↗
        </a>
      </div>
      <p className="text-gray-600 dark:text-gray-300 text-sm">{description}</p>
    </div>
  )
}
