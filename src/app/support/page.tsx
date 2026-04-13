import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Help & Support — BillByDab',
  description: 'Answers to common questions about BillByDab — the free invoice generator for freelancers and small businesses.',
  alternates: {
    canonical: 'https://www.billbydab.com/support',
  },
}

const faqs = [
  {
    q: 'Is BillByDab really free?',
    a: 'Yes — completely free, forever. No credit card required, no hidden fees, no usage limits. BillByDab is built to be the free invoice tool that freelancers and small businesses actually deserve.',
  },
  {
    q: 'Do I need an account to create an invoice?',
    a: "No account needed to get started. You can fill in your details, add line items, and download a PDF right away. Create a free account if you'd like to save invoices, track status, manage clients, and access your history from any device.",
  },
  {
    q: 'How do I download my invoice as a PDF?',
    a: 'Once you\'ve filled in your invoice details, click the "Download PDF" button in the invoice preview. A pixel-perfect PDF will be generated instantly — ready to send to your client or keep for your records.',
  },
  {
    q: 'Can I send invoices directly to my clients?',
    a: 'Yes. From your dashboard, open any saved invoice and click "Send Invoice". Enter your client\'s email address and we\'ll deliver a professional HTML email with all invoice details, line items, and payment instructions.',
  },
  {
    q: 'How do I add my logo and brand color?',
    a: "In the invoice editor, look for the 'Business Details' section. You can upload your logo (PNG, JPG, or SVG) and pick a brand color — both will appear on your invoice and in the email sent to your client.",
  },
  {
    q: 'Is my data safe?',
    a: 'Your data is stored securely using Supabase, with row-level security ensuring only you can access your invoices and client information. We never sell your data or share it with third parties.',
  },
  {
    q: 'How do I save my payment details?',
    a: "In the invoice form, expand the 'Payment Details' section. You can add bank transfer details, mobile money (e.g. M-Pesa), or any other payment method. These details are included in the invoice PDF and email sent to your client.",
  },
  {
    q: 'How do I contact support?',
    a: 'You can reach us via the contact form at billbydab.com/contact or email us directly at support@billbydab.com. We respond within 24 hours, Monday to Sunday.',
  },
]

export default function SupportPage() {
  return (
    <main className="bg-white min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Heading */}
        <div className="mb-12">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Help &amp; Support</h1>
          <p className="text-gray-500">Answers to the most common questions about BillByDab.</p>
        </div>

        {/* FAQ accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none hover:bg-gray-50 transition-colors">
                <span className="font-semibold text-gray-900 text-sm pr-4">{faq.q}</span>
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
              <div className="px-6 pb-5 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        {/* CTA card */}
        <div className="mt-14 bg-indigo-50 border border-indigo-100 rounded-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl mb-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Still need help?</h2>
          <p className="text-sm text-gray-500 mb-5">
            Can't find what you're looking for? Our support team is here to help.
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
