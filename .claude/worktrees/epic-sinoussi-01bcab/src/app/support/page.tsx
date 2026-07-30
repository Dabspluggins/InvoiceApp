import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Support & FAQ - BillByDab',
  description: 'Get help with BillByDab. Find answers to common questions about invoices, accounts, currencies, payment details, data safety, and support.',
  alternates: {
    canonical: 'https://www.billbydab.com/support',
  },
}

const faqs = [
  {
    q: 'Is BillByDab free?',
    a: 'Yes — creating and downloading invoices is completely free. No credit card needed.',
  },
  {
    q: 'Do I need an account to create an invoice?',
    a: "No account is needed to get started. You can fill in your details, add line items, and download a PDF right away. Create a free account if you'd like to save invoices, track status, manage clients, and access your history from any device.",
  },
  {
    q: 'How do I save my invoices?',
    a: 'Sign up for a free account and all your invoices are saved automatically to your dashboard.',
  },
  {
    q: 'How do I download my invoice as a PDF?',
    a: 'Once your invoice details are complete, use the Download PDF button in the invoice preview. The PDF is generated immediately so you can send it to your client or keep it for your records.',
  },
  {
    q: 'Can I send invoices directly to my clients?',
    a: 'Yes. From your dashboard, open a saved invoice and use Send Invoice. BillByDab sends your client a professional email with the invoice details, line items, and payment instructions.',
  },
  {
    q: 'How do I add my logo?',
    a: "On the invoice form, click Upload Logo and select an image from your device. It'll appear on the invoice preview and invoice email.",
  },
  {
    q: 'Can I change the currency?',
    a: 'Yes — the currency selector is on the invoice form. We support NGN, USD, EUR, GBP, and more.',
  },
  {
    q: 'How do I add payment details?',
    a: 'Use the Payment Details section on the invoice form. You can add bank transfer details, mobile money, or another payment method so clients know exactly how to pay.',
  },
  {
    q: 'How do I mark an invoice as paid?',
    a: 'Open your dashboard, find the invoice, and use the status dropdown to choose Paid.',
  },
  {
    q: 'Is my data safe?',
    a: 'Your account data is protected with Supabase authentication and row-level security, so users can only access their own invoices, clients, and account records.',
  },
  {
    q: 'How do I contact support?',
    a: 'Use the contact form or email support@billbydab.com. We aim to respond within 24 hours.',
  },
]

export default function SupportPage() {
  return (
    <main className="bg-white dark:bg-gray-900 min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Heading */}
        <div className="mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Support &amp; FAQ</h1>
          <p className="text-gray-500 dark:text-gray-400">We&apos;re here to help. Responses within 24 hours.</p>
        </div>

        {/* FAQ accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <span className="font-semibold text-gray-900 dark:text-white text-sm pr-4">{faq.q}</span>
                {/* Chevron — rotates when open */}
                <svg
                  className="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-5 pt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-700">
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        {/* Still need help */}
        <div className="mt-14 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl mb-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Still need help?</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Email us at{' '}
            <a
              href="mailto:support@billbydab.com"
              className="text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              support@billbydab.com
            </a>{' '}
            — we respond within 24 hours.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors"
          >
            Contact us
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </main>
  )
}
