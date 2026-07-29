import Link from 'next/link'

const features = [
  {
    icon: '📄',
    title: 'PDF Export',
    desc: 'Download a pixel-perfect PDF invoice in one click, ready to send to any client.',
  },
  {
    icon: '💱',
    title: 'Multi-Currency',
    desc: 'Bill clients in USD, EUR, GBP, NGN, CAD, AUD and more with correct formatting.',
  },
  {
    icon: '🎨',
    title: 'Custom Branding',
    desc: 'Upload your logo and add your business details for a fully branded invoice.',
  },
  {
    icon: '📊',
    title: 'Invoice Tracking',
    desc: 'Track invoice status — draft, sent, pending, or paid. (Coming soon)',
  },
  {
    icon: '📱',
    title: 'Mobile Friendly',
    desc: 'Create invoices from any device. Works seamlessly on phones and tablets.',
  },
  {
    icon: '🔓',
    title: 'No Account Needed',
    desc: 'Start creating invoices immediately — no sign-up, no credit card, no friction.',
  },
]

export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="inline-block bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wide">
            Free Forever
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            Create Professional Invoices{' '}
            <span className="text-indigo-600">in Seconds</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            Free forever. No signup required. Download as PDF instantly.
          </p>
          <Link
            href="/invoice"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-md transition-colors"
          >
            Create Your Invoice
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="mt-4 text-sm text-gray-400">No credit card. No account. Just invoices.</p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">Everything you need</h2>
        <p className="text-center text-gray-500 mb-12">Built for freelancers, consultants, and small businesses.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-indigo-600 text-white py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get paid faster?</h2>
          <p className="text-indigo-200 mb-8">Create a professional invoice right now — it takes less than 2 minutes.</p>
          <Link
            href="/invoice"
            className="inline-block bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-8 py-3 rounded-xl transition-colors shadow"
          >
            Start for Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-8">
        &copy; {new Date().getFullYear()} InvoiceFree. Built for freelancers everywhere.
      </footer>
    </main>
  )
}
