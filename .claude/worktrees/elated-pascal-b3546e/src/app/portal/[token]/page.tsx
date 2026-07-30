import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type Invoice = {
  id: string
  invoice_number: string
  issue_date: string
  due_date: string | null
  total: number
  currency: string
  status: string
  share_token: string | null
  business_name: string | null
}

type Client = {
  id: string
  name: string
  company: string | null
  email: string | null
  portal_token: string
  user_id: string
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type DisplayStatus = 'PAID' | 'OVERDUE' | 'PENDING'

function getDisplayStatus(invoice: Invoice): DisplayStatus {
  if (invoice.status === 'paid') return 'PAID'
  if (
    invoice.due_date &&
    new Date(invoice.due_date + 'T23:59:59') < new Date() &&
    invoice.status !== 'paid'
  )
    return 'OVERDUE'
  return 'PENDING'
}

const STATUS_STYLES: Record<DisplayStatus, string> = {
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300',
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/60 dark:text-yellow-300',
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

type CurrencySummary = {
  currency: string
  total: number
  paid: number
  outstanding: number
}

function buildSummaries(invoices: Invoice[]): CurrencySummary[] {
  const map: Record<string, CurrencySummary> = {}
  for (const inv of invoices) {
    const c = inv.currency
    if (!map[c]) map[c] = { currency: c, total: 0, paid: 0, outstanding: 0 }
    map[c].total += inv.total
    if (inv.status === 'paid') {
      map[c].paid += inv.total
    } else {
      map[c].outstanding += inv.total
    }
  }
  return Object.values(map)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const supabase = getServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('name, company')
    .eq('portal_token', token)
    .single<{ name: string; company: string | null }>()

  if (!client) return { title: 'Portal | BillByDab' }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('business_name')
    .ilike('client_email', client.name)
    .limit(1)
    .single<{ business_name: string | null }>()

  const businessName = invoice?.business_name || 'BillByDab'
  return {
    title: `Invoices from ${businessName} | BillByDab`,
    robots: { index: false, follow: false },
  }
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = getServiceClient()

  // 1. Look up client by portal_token
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name, company, email, portal_token, user_id')
    .eq('portal_token', token)
    .single<Client>()

  if (clientError || !client || !client.email) {
    notFound()
  }

  // 2. Fetch all invoices for this client's email (case-insensitive)
  const { data: invoices } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, issue_date, due_date, total, currency, status, share_token, business_name'
    )
    .ilike('client_email', client.email)
    .eq('user_id', client.user_id)
    .order('issue_date', { ascending: false })

  const allInvoices: Invoice[] = invoices || []
  const businessName = allInvoices[0]?.business_name || 'BillByDab'
  const summaries = buildSummaries(allInvoices)
  const clientLabel = client.company
    ? `${client.name} / ${client.company}`
    : client.name

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10 md:py-16">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{businessName}</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base">
            Invoices for <span className="font-medium text-gray-700">{clientLabel}</span>
          </p>
        </div>

        {/* Summary cards */}
        {summaries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {summaries.length === 1 ? (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Total Billed
                  </p>
                  <p className="text-xl font-bold text-indigo-600">
                    {formatCurrency(summaries[0].total, summaries[0].currency)}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Paid
                  </p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(summaries[0].paid, summaries[0].currency)}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Outstanding
                  </p>
                  <p className="text-xl font-bold text-orange-500">
                    {formatCurrency(summaries[0].outstanding, summaries[0].currency)}
                  </p>
                </div>
              </>
            ) : (
              <div className="sm:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
                  Summary by Currency
                </p>
                <div className="space-y-2">
                  {summaries.map((s) => (
                    <div key={s.currency} className="flex flex-wrap gap-4 text-sm">
                      <span className="font-semibold text-gray-700 w-12">{s.currency}</span>
                      <span className="text-gray-600">
                        Total:{' '}
                        <span className="font-semibold text-indigo-600">
                          {formatCurrency(s.total, s.currency)}
                        </span>
                      </span>
                      <span className="text-gray-600">
                        Paid:{' '}
                        <span className="font-semibold text-green-600">
                          {formatCurrency(s.paid, s.currency)}
                        </span>
                      </span>
                      <span className="text-gray-600">
                        Outstanding:{' '}
                        <span className="font-semibold text-orange-500">
                          {formatCurrency(s.outstanding, s.currency)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invoice list */}
        {allInvoices.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400 text-sm">No invoices found for this portal.</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                    <th className="text-left px-6 py-3">Invoice #</th>
                    <th className="text-left px-6 py-3">Date</th>
                    <th className="text-left px-6 py-3">Due Date</th>
                    <th className="text-right px-6 py-3">Amount</th>
                    <th className="text-center px-6 py-3">Status</th>
                    <th className="text-right px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allInvoices.map((inv) => {
                    const displayStatus = getDisplayStatus(inv)
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {inv.invoice_number}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(inv.issue_date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(inv.due_date)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(inv.total, inv.currency)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[displayStatus]}`}
                          >
                            {displayStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {inv.share_token ? (
                            <Link
                              href={`/i/${inv.share_token}`}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              View Invoice →
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col gap-3">
              {allInvoices.map((inv) => {
                const displayStatus = getDisplayStatus(inv)
                return (
                  <div
                    key={inv.id}
                    className="bg-white rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {inv.invoice_number}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(inv.issue_date)}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[displayStatus]}`}
                      >
                        {displayStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <p className="text-base font-bold text-gray-900">
                          {formatCurrency(inv.total, inv.currency)}
                        </p>
                        {inv.due_date && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Due {formatDate(inv.due_date)}
                          </p>
                        )}
                      </div>
                      {inv.share_token && (
                        <Link
                          href={`/i/${inv.share_token}`}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-3 py-1.5 rounded-lg"
                        >
                          View Invoice →
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-10">
          Powered by{' '}
          <a
            href="https://www.billbydab.com"
            className="hover:text-indigo-500 transition"
            target="_blank"
            rel="noopener noreferrer"
          >
            BillByDab
          </a>{' '}
          — free invoice generator at billbydab.com
        </p>
      </div>
    </div>
  )
}
