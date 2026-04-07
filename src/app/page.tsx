import Link from 'next/link'

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
    <main className="bg-white">
      {/* Hero */}
      <section className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 uppercase tracking-wide">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Free forever — no credit card needed
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-[1.1] tracking-tight mb-6">
            Invoice clients.<br />
            <span className="text-indigo-600">Get paid faster.</span>
          </h1>

          <p className="text-xl text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Create professional invoices in seconds. Free, no account needed to start.
            Download as PDF and send right away.
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
              className="inline-flex items-center gap-2 text-gray-700 hover:text-indigo-600 font-semibold text-base px-7 py-3.5 rounded-xl border border-gray-200 hover:border-indigo-200 transition-colors"
            >
              See Dashboard
            </Link>
          </div>

          <p className="text-sm text-gray-400">No signup required &middot; Works on any device</p>
        </div>

        {/* Invoice mockup */}
        <div className="max-w-2xl mx-auto px-6 pb-16">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            {/* Mockup header bar */}
            <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-200" />
              <div className="w-3 h-3 rounded-full bg-gray-200" />
              <div className="w-3 h-3 rounded-full bg-gray-200" />
              <div className="flex-1 mx-4">
                <div className="bg-gray-200 rounded h-5 w-48 mx-auto" />
              </div>
            </div>

            {/* Mockup invoice content */}
            <div className="p-6 sm:p-8">
              {/* Invoice top */}
              <div className="flex justify-between items-start mb-8">
                <div className="space-y-1.5">
                  <div className="bg-indigo-100 rounded h-5 w-32" />
                  <div className="bg-gray-100 rounded h-3.5 w-40" />
                  <div className="bg-gray-100 rounded h-3.5 w-28" />
                </div>
                <div className="text-right space-y-1.5">
                  <div className="bg-indigo-600 rounded h-6 w-24 ml-auto" />
                  <div className="bg-gray-100 rounded h-3 w-28 ml-auto" />
                  <div className="bg-gray-100 rounded h-3 w-20 ml-auto" />
                </div>
              </div>

              {/* Bill to */}
              <div className="space-y-1.5 mb-6">
                <div className="bg-gray-200 rounded h-3 w-16" />
                <div className="bg-gray-100 rounded h-3.5 w-36" />
                <div className="bg-gray-100 rounded h-3 w-48" />
              </div>

              {/* Line items table */}
              <div className="border border-gray-100 rounded-xl overflow-hidden mb-6">
                <div className="bg-gray-50 px-4 py-2.5 flex gap-4">
                  <div className="flex-1 bg-gray-200 rounded h-3" />
                  <div className="w-16 bg-gray-200 rounded h-3" />
                  <div className="w-16 bg-gray-200 rounded h-3" />
                  <div className="w-16 bg-gray-200 rounded h-3" />
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-4 py-2.5 flex gap-4 border-t border-gray-100">
                    <div className="flex-1 bg-gray-100 rounded h-3" />
                    <div className="w-16 bg-gray-100 rounded h-3" />
                    <div className="w-16 bg-gray-100 rounded h-3" />
                    <div className="w-16 bg-indigo-100 rounded h-3" />
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-48 space-y-2">
                  <div className="flex justify-between">
                    <div className="bg-gray-100 rounded h-3 w-16" />
                    <div className="bg-gray-100 rounded h-3 w-12" />
                  </div>
                  <div className="flex justify-between">
                    <div className="bg-gray-100 rounded h-3 w-10" />
                    <div className="bg-gray-100 rounded h-3 w-8" />
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between">
                    <div className="bg-gray-200 rounded h-4 w-12" />
                    <div className="bg-indigo-600 rounded h-4 w-16" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Everything you need to get paid</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Built for freelancers, consultants, and small businesses who want to look professional without the overhead.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 leading-snug">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">How it works</h2>
            <p className="text-gray-500 text-lg">Three simple steps from zero to paid invoice.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-8 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-gray-200" />

            {steps.map((step) => (
              <div key={step.number} className="flex flex-col items-center text-center">
                <div className="relative flex items-center justify-center w-16 h-16 bg-indigo-600 text-white rounded-full text-xl font-bold mb-5 shadow-md flex-shrink-0 z-10">
                  {step.number}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-lg leading-snug">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
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
      <footer className="bg-white border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-bold text-gray-900">BillByDab</span>
          </div>

          <nav className="flex items-center gap-6">
            <Link href="/invoice" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">Invoice</Link>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">Dashboard</Link>
            <Link href="/auth/signup" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors">Sign Up</Link>
          </nav>

          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} BillByDab. All rights reserved.</p>
        </div>
      </footer>
    </main>
  )
}
