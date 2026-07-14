import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — BillByDab',
  description:
    'Read the Terms of Service for BillByDab, the free invoice generation tool for freelancers and small businesses.',
}

export default function TermsPage() {
  return (
    <main className="bg-white dark:bg-gray-900 min-h-screen">
      {/* Page header */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 py-12">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-2">Legal</p>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Terms of Service</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Effective date: April 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="prose prose-gray max-w-none">

          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-10">
            Please read these Terms of Service (&ldquo;Terms&rdquo;) carefully before using
            BillByDab (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) at{' '}
            <span className="font-medium text-gray-800">billbydab.com</span>. By accessing or
            using the service you agree to be bound by these Terms. If you do not agree, please
            do not use the service.
          </p>

          <Section title="1. Acceptance of Terms">
            <p className="text-gray-600 leading-relaxed">
              By creating an account or otherwise using BillByDab, you confirm that you are at
              least 13 years old, that you have read and understood these Terms, and that you
              agree to be bound by them and by our{' '}
              <Link href="/privacy" className="text-indigo-600 hover:underline">
                Privacy Policy
              </Link>
              . These Terms form a legally binding agreement between you and BillByDab.
            </p>
          </Section>

          <Section title="2. Service Description">
            <p className="text-gray-600 leading-relaxed mb-4">
              BillByDab is a free online invoice generation tool that lets freelancers and small
              businesses create, send, and manage invoices. The core service is provided at no
              charge.
            </p>
            <p className="text-gray-600 leading-relaxed">
              We do not guarantee continuous, uninterrupted, or error-free access to the service.
              We may perform maintenance, upgrades, or make changes to the platform at any time
              without prior notice. BillByDab shall not be liable for any downtime or service
              interruptions.
            </p>
          </Section>

          <Section title="3. Account Responsibilities">
            <p className="text-gray-600 leading-relaxed mb-4">
              When you create an account you agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>
                Provide accurate, current, and complete information and keep it up to date.
              </li>
              <li>
                Keep your login credentials confidential. You are responsible for all activity
                that occurs under your account.
              </li>
              <li>
                Notify us immediately at{' '}
                <a href="mailto:support@billbydab.com" className="text-indigo-600 hover:underline">
                  support@billbydab.com
                </a>{' '}
                if you suspect unauthorised access to your account.
              </li>
              <li>Not share your account with others or create accounts on behalf of third parties without their consent.</li>
            </ul>
          </Section>

          <Section title="4. Acceptable Use">
            <p className="text-gray-600 leading-relaxed mb-4">
              You agree to use BillByDab only for lawful purposes and in accordance with these
              Terms. You must not:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Use the service for any illegal activity, including fraud or money laundering.</li>
              <li>
                Create invoices that misrepresent the origin of goods or services, or that
                facilitate deceptive business practices.
              </li>
              <li>
                Attempt to scrape, crawl, or systematically extract data from the platform using
                automated means.
              </li>
              <li>
                Attempt to bypass, disable, or interfere with any security feature of the service.
              </li>
              <li>
                Abuse the free service in ways that place unreasonable load on our infrastructure
                (e.g., generating thousands of invoices programmatically for non-business purposes).
              </li>
              <li>
                Upload content that is unlawful, harmful, threatening, abusive, defamatory, or
                that infringes any third-party intellectual property rights.
              </li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-4">
              We reserve the right to investigate suspected violations and take appropriate action,
              including suspending or terminating accounts.
            </p>
          </Section>

          <Section title="5. Intellectual Property">
            <p className="text-gray-600 leading-relaxed mb-4">
              <strong>Platform:</strong> BillByDab, including its design, source code, trademarks,
              and all platform content, is owned by BillByDab and protected by applicable
              intellectual property laws. You may not copy, modify, distribute, or reverse-engineer
              any part of the platform without our express written permission.
            </p>
            <p className="text-gray-600 leading-relaxed">
              <strong>Your content:</strong> You retain full ownership of all invoice data, client
              information, and other content you create or upload through the service. By using
              BillByDab you grant us a limited, non-exclusive licence to store and process your
              content solely to provide the service to you.
            </p>
          </Section>

          <Section title="6. Disclaimers">
            <p className="text-gray-600 leading-relaxed mb-4">
              BillByDab is provided <strong>&ldquo;as is&rdquo;</strong> and{' '}
              <strong>&ldquo;as available&rdquo;</strong> without warranty of any kind, express or
              implied, including but not limited to warranties of merchantability, fitness for a
              particular purpose, or non-infringement.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              BillByDab is an invoice creation tool only. We are not accountants, lawyers, or
              financial advisers. Invoices generated through the platform are provided for your
              convenience. We are not responsible for any financial, legal, or tax decisions you
              make based on invoices created using our service. You should consult a qualified
              professional for advice specific to your situation.
            </p>
            <p className="text-gray-600 leading-relaxed">
              To the fullest extent permitted by applicable law, BillByDab shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages arising out of
              or related to your use of the service.
            </p>
          </Section>

          <Section title="7. Termination">
            <p className="text-gray-600 leading-relaxed mb-4">
              You may delete your account at any time from the Settings page. Upon deletion, your
              data will be removed in accordance with our{' '}
              <Link href="/privacy" className="text-indigo-600 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
            <p className="text-gray-600 leading-relaxed">
              We reserve the right to suspend or terminate your account at any time, with or
              without notice, if we determine that you have violated these Terms or that your use
              of the service poses a risk to other users or to the platform. We will make
              reasonable efforts to notify you by email in non-urgent cases.
            </p>
          </Section>

          <Section title="8. Changes to These Terms">
            <p className="text-gray-600 leading-relaxed">
              We may update these Terms from time to time. When we do, we will update the effective
              date at the top of this page. For material changes we will notify you by email or via
              an in-app notice at least 14 days before the changes take effect. Your continued use
              of BillByDab after the changes take effect constitutes your acceptance of the revised
              Terms.
            </p>
          </Section>

          <Section title="9. Governing Law">
            <p className="text-gray-600 leading-relaxed">
              These Terms are governed by and construed in accordance with the laws of{' '}
              <strong>Lagos, Nigeria</strong>, without regard to its conflict of law provisions.
              Any disputes arising under or in connection with these Terms shall be subject to the
              exclusive jurisdiction of the courts located in Lagos, Nigeria.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p className="text-gray-600 leading-relaxed">
              If you have any questions about these Terms, please contact us at{' '}
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
          <Link href="/privacy" className="hover:text-indigo-600 transition-colors">
            Privacy Policy
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
