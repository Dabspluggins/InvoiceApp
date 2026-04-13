import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  alternates: {
    canonical: 'https://www.billbydab.com',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'BillByDab',
  url: 'https://www.billbydab.com',
  description: 'Free invoice generator for freelancers and small businesses',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: [
    'Create professional invoices',
    'Send invoices by email',
    'Track invoice status',
    'Recurring invoices',
    'Invoice templates',
    'Client management',
    'Revenue analytics',
  ],
}

const features = [
  {
    title: 'Create & send invoices in minutes',
    desc: 'Fill in your details, add line items, and generate a professional invoice instantly.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Download as PDF instantly',
    desc: 'Get a pixel-perfect PDF with one click — no account required, ready to send.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
  {
    title: 'Track invoice status',
    desc: 'Stay on top of every invoice — Draft, Sent, Pending, or Paid — from your dashboard.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Save and manage all your invoices',
    desc: 'Create an account to save invoices, access your history, and manage everything in one place.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    title: 'Multi-currency support',
    desc: 'Invoice clients in USD, EUR, GBP, NGN, CAD, AUD — with correct formatting for each.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Free forever',
    desc: 'No credit card required. No hidden fees. No limits. BillByDab is free to use for everyone.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
]

const steps = [
  {
    number: '1',
    title: 'Fill in your details and line items',
    desc: "Enter your business info, client details, and the services or products you're billing for.",
  },
  {
    number: '2',
    title: 'Download as PDF or save to your account',
    desc: 'Grab a PDF immediately — no sign-up needed. Or create a free account to save and manage invoices.',
  },
  {
    number: '3',
    title: 'Track and update from your dashboard',
    desc: "Mark invoices as Sent, Pending, or Paid. See your full history and stay on top of what's owed.",
  },
]

export default function Home() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 uppercase tracking-wide">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Free forever — no credit card needed
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 dark:text-white leading-[1.1] tracking-tight mb-6">
            Free invoice generator<br />
            <span className="text-indigo-600">for freelancers &amp; businesses.</span>
          </h1>

          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Create and send professional invoices online for free — no account needed to start.
            Fill in your details, download as PDF, and get paid faster.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Link
              href="/invoice"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base px-7 py-3.5 rounded-xl shadow-sm transition-colors"
            >
              Create Invoice Free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:text-indigo-600 font-semibold text-base px-7 py-3.5 rounded-xl border border-gray-200 dark:border-gray-600 hover:border-indigo-200 transition-colors"
            >
              See Dashboard
            </Link>
          </div>

          <p className="text-sm text-gray-400 dark:text-gray-500">No signup required &middot; Works on any device</p>
        </div>
      </section>

      {/* Invoice Mockup Preview */}
      <section className="bg-gray-50 dark:bg-gray-800 border-y border-gray-100 dark:border-gray-700 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-2">Live Preview</p>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-8">Here's what your invoice looks like</h2>
          {/* Mockup card — scaled down so it fits without being too tall */}
          <div className="flex justify-center">
            <div className="origin-top transform scale-90 w-full max-w-[600px] bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200 text-left">
              {/* Colored header bar */}
              <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
                <span className="text-white text-xl font-extrabold tracking-widest uppercase">Invoice</span>
                <span className="text-white text-lg font-bold tracking-tight">BillByDab</span>
              </div>

              <div className="px-6 pt-5 pb-4">
                {/* From / Bill To columns */}
                <div className="grid grid-cols-2 gap-6 mb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1">From</p>
                    <p className="text-sm font-semibold text-gray-800">Dab Studio LLC</p>
                    <p className="text-xs text-gray-500">14 Crescent Avenue</p>
                    <p className="text-xs text-gray-500">Lagos, Nigeria</p>
                    <p className="text-xs text-gray-500">hello@dabstudio.co</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1">Bill To</p>
                    <p className="text-sm font-semibold text-gray-800">Acme Corp Inc.</p>
                    <p className="text-xs text-gray-500">88 Market Street, Suite 4</p>
                    <p className="text-xs text-gray-500">San Francisco, CA 94105</p>
                    <p className="text-xs text-gray-500">billing@acmecorp.com</p>
                  </div>
                </div>

                {/* Meta row */}
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5 grid grid-cols-3 gap-2 mb-5">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">Invoice #</p>
                    <p className="text-xs font-bold text-gray-700">INV-0042</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">Issue Date</p>
                    <p className="text-xs font-bold text-gray-700">Apr 1, 2026</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">Due Date</p>
                    <p className="text-xs font-bold text-gray-700">Apr 30, 2026</p>
                  </div>
                </div>

                {/* Line items table */}
                <table className="w-full text-xs mb-5">
                  <thead>
                    <tr className="bg-indigo-50 text-indigo-700">
                      <th className="text-left py-2 px-3 font-semibold rounded-l-md">Description</th>
                      <th className="text-center py-2 px-2 font-semibold">Qty</th>
                      <th className="text-right py-2 px-2 font-semibold">Rate</th>
                      <th className="text-right py-2 px-3 font-semibold rounded-r-md">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="text-gray-700">
                      <td className="py-2.5 px-3">Website Design</td>
                      <td className="py-2.5 px-2 text-center text-gray-500">1</td>
                      <td className="py-2.5 px-2 text-right text-gray-500">$1,200.00</td>
                      <td className="py-2.5 px-3 text-right font-medium">$1,200.00</td>
                    </tr>
                    <tr className="text-gray-700">
                      <td className="py-2.5 px-3">SEO Consultation</td>
                      <td className="py-2.5 px-2 text-center text-gray-500">3</td>
                      <td className="py-2.5 px-2 text-right text-gray-500">$150.00</td>
                      <td className="py-2.5 px-3 text-right font-medium">$450.00</td>
                    </tr>
                    <tr className="text-gray-700">
                      <td className="py-2.5 px-3">Monthly Retainer</td>
                      <td className="py-2.5 px-2 text-center text-gray-500">1</td>
                      <td className="py-2.5 px-2 text-right text-gray-500">$800.00</td>
                      <td className="py-2.5 px-3 text-right font-medium">$800.00</td>
                    </tr>
                  </tbody>
                </table>

                {/* Totals — bottom right */}
                <div className="flex justify-end">
                  <div className="w-52 space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span>$2,450.00</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Tax (10%)</span>
                      <span>$245.00</span>
                    </div>
                    <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-gray-800 text-sm">
                      <span>Total</span>
                      <span className="text-indigo-600">$2,695.00</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer strip */}
              <div className="bg-indigo-600 h-1.5" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">The free invoice generator built for freelancers</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg max-w-xl mx-auto">
              Create invoices online in seconds — no overhead, no credit card, no limits. BillByDab is the free invoice maker trusted by freelancers, consultants, and small businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white dark:bg-gray-700 rounded-2xl p-6 border border-gray-100 dark:border-gray-600 shadow-sm hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-500 transition-all"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 leading-snug">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">How it works</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Three simple steps from zero to paid invoice.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-8 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-gray-200" />

            {steps.map((step) => (
              <div key={step.number} className="flex flex-col items-center text-center">
                <div className="relative flex items-center justify-center w-16 h-16 bg-indigo-600 text-white rounded-full text-xl font-bold mb-5 shadow-md flex-shrink-0 z-10">
                  {step.number}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg leading-snug">{step.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-indigo-600 py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Start invoicing for free today
          </h2>
          <p className="text-indigo-200 text-lg mb-10 leading-relaxed">
            No credit card. No setup. Just create your first invoice in under 2 minutes.
          </p>
          <Link
            href="/invoice"
            className="inline-flex items-center gap-2 bg-white text-indigo-600 hover:bg-indigo-50 font-semibold text-base px-8 py-3.5 rounded-xl shadow-sm transition-colors"
          >
            Create Invoice
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-bold text-gray-900 dark:text-white">BillByDab</span>
          </div>

          <nav className="flex items-center gap-6">
            <Link href="/invoice" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors">Invoice</Link>
            <Link href="/dashboard" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors">Dashboard</Link>
            <Link href="/auth/signup" className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-colors">Sign Up</Link>
          </nav>

          <p className="text-sm text-gray-400 dark:text-gray-500">&copy; {new Date().getFullYear()} BillByDab. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
