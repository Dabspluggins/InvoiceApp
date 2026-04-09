import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'
import PrintButton from './PrintButton'

interface LineItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

interface InvoiceRow {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string | null
  currency: string
  business_name: string | null
  business_address: string | null
  business_email: string | null
  business_phone: string | null
  logo_url: string | null
  client_name: string | null
  client_company: string | null
  client_address: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  notes: string | null
  brand_color: string | null
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getInvoice(token: string) {
  const supabase = getServiceClient()
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('share_token', token)
    .single()
  if (!invoice) return null

  const { data: items } = await supabase
    .from('line_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('sort_order')

  return { invoice: invoice as InvoiceRow, lineItems: (items || []) as LineItem[] }
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const result = await getInvoice(token)
  if (!result) return { title: 'Invoice not found — BillByDab' }
  const { invoice } = result
  return {
    title: `Invoice ${invoice.invoice_number}${invoice.business_name ? ` from ${invoice.business_name}` : ''} — BillByDab`,
  }
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await getInvoice(token)
  const brandColor = result?.invoice.brand_color || '#4F46E5'

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">📄</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Invoice not found</h1>
          <p className="text-gray-500 mb-8">
            This invoice link may have expired or doesn&apos;t exist. Please contact the sender for a
            new link.
          </p>
          <a
            href="https://www.billbydab.com"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            Go to BillByDab
          </a>
        </div>
      </div>
    )
  }

  const { invoice, lineItems } = result

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-card { box-shadow: none !important; }
        }
      `}</style>

      {/* Nav bar */}
      <nav className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <a href="https://www.billbydab.com" className="flex items-center gap-2">
          <span
            className="text-lg font-bold"
            style={{ color: brandColor }}
          >
            BillByDab
          </span>
        </a>
        <PrintButton />
      </nav>

      {/* Page background */}
      <main className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
        <div className="invoice-card max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden print:shadow-none print:rounded-none">

          {/* Brand color header stripe */}
          <div className="px-8 py-8 sm:px-10" style={{ backgroundColor: brandColor }}>
            {invoice.logo_url && (
              <img
                src={invoice.logo_url}
                alt="Logo"
                className="mb-4 max-h-16 max-w-[180px] object-contain rounded"
                style={{ background: 'rgba(255,255,255,0.15)', padding: '4px' }}
              />
            )}
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-1">
              Invoice from
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {invoice.business_name || 'Business'}
            </h1>
            {invoice.business_address && (
              <p className="text-sm text-white/75 mt-1 whitespace-pre-line">
                {invoice.business_address}
              </p>
            )}
            {invoice.business_email && (
              <p className="text-sm text-white/75">{invoice.business_email}</p>
            )}
            {invoice.business_phone && (
              <p className="text-sm text-white/75">{invoice.business_phone}</p>
            )}
          </div>

          {/* Invoice meta */}
          <div className="px-8 sm:px-10 py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between gap-6">
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-1">Bill To</p>
              <p className="text-base font-semibold text-gray-900">{invoice.client_name || '—'}</p>
              {invoice.client_company && (
                <p className="text-sm text-gray-500">{invoice.client_company}</p>
              )}
              {invoice.client_address && (
                <p className="text-sm text-gray-500 whitespace-pre-line mt-0.5">
                  {invoice.client_address}
                </p>
              )}
            </div>
            <div className="sm:text-right">
              <div className="mb-3">
                <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Invoice #</p>
                <p className="text-base font-bold text-gray-900">{invoice.invoice_number}</p>
              </div>
              <div className="mb-3">
                <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Issue Date</p>
                <p className="text-sm text-gray-700">{invoice.issue_date}</p>
              </div>
              {invoice.due_date && (
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Due Date</p>
                  <p className="text-sm font-semibold text-gray-900">{invoice.due_date}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className="px-8 sm:px-10 py-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: brandColor }}>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-white rounded-tl-lg">
                      Description
                    </th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-white">
                      Qty
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-white">
                      Rate
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-white rounded-tr-lg">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, i) => (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="px-3 py-3 text-gray-700">{item.description || '—'}</td>
                      <td className="px-3 py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {fmt(item.rate, invoice.currency)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-800 font-medium">
                        {fmt(item.amount, invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-full sm:w-72 space-y-2">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>{fmt(invoice.subtotal, invoice.currency)}</span>
                </div>
                {invoice.tax_rate > 0 && (
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Tax ({invoice.tax_rate}%)</span>
                    <span>{fmt(invoice.tax_amount, invoice.currency)}</span>
                  </div>
                )}
                <div
                  className="flex justify-between text-base font-bold pt-2 border-t-2"
                  style={{ borderColor: brandColor, color: brandColor }}
                >
                  <span>Total Due</span>
                  <span>{fmt(invoice.total, invoice.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="px-8 sm:px-10 pb-6">
              <div
                className="rounded-lg p-4"
                style={{ borderLeft: `3px solid ${brandColor}`, background: '#F9FAFB' }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 sm:px-10 py-5 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Powered by{' '}
              <a
                href="https://www.billbydab.com"
                className="font-semibold text-gray-500 hover:text-indigo-600 transition"
              >
                BillByDab
              </a>{' '}
              — free invoice generator at billbydab.com
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
