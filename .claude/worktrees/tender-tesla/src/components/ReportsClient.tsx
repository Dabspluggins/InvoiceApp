'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrencySymbol } from '@/lib/currencies'
import { InvoiceStatus, Currency } from '@/lib/types'

interface ReportInvoice {
  id: string
  invoice_number: string
  client_name: string
  client_company: string | null
  total: number
  currency: Currency
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  tax_rate: number | null
}

type Preset = 'this-month' | 'last-month' | 'this-quarter' | 'last-quarter' | 'this-year' | 'last-year' | 'custom'

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'This Month', value: 'this-month' },
  { label: 'Last Month', value: 'last-month' },
  { label: 'This Quarter', value: 'this-quarter' },
  { label: 'Last Quarter', value: 'last-quarter' },
  { label: 'This Year', value: 'this-year' },
  { label: 'Last Year', value: 'last-year' },
  { label: 'Custom', value: 'custom' },
]

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

const TODAY = new Date().toISOString().split('T')[0]

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const quarter = Math.ceil(month / 3)

  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate()

  switch (preset) {
    case 'this-month':
      return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${lastDay(year, month)}` }
    case 'last-month': {
      const lm = month === 1 ? 12 : month - 1
      const ly = month === 1 ? year - 1 : year
      return { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-${lastDay(ly, lm)}` }
    }
    case 'this-quarter': {
      const qs = (quarter - 1) * 3 + 1
      const qe = quarter * 3
      return { from: `${year}-${pad(qs)}-01`, to: `${year}-${pad(qe)}-${lastDay(year, qe)}` }
    }
    case 'last-quarter': {
      const lq = quarter === 1 ? 4 : quarter - 1
      const lqy = quarter === 1 ? year - 1 : year
      const qs = (lq - 1) * 3 + 1
      const qe = lq * 3
      return { from: `${lqy}-${pad(qs)}-01`, to: `${lqy}-${pad(qe)}-${lastDay(lqy, qe)}` }
    }
    case 'this-year':
      return { from: `${year}-01-01`, to: `${year}-12-31` }
    case 'last-year':
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` }
    default:
      return { from: `${year}-01-01`, to: `${year}-12-31` }
  }
}

function calcTaxAmount(total: number, taxRate: number): number {
  if (!taxRate || taxRate <= 0) return 0
  // total = subtotal + subtotal*(taxRate/100) => taxAmount = total * taxRate / (100 + taxRate)
  return total * taxRate / (100 + taxRate)
}

function fmt(amount: number, currency: string) {
  const symbol = getCurrencySymbol(currency)
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtNum(amount: number) {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isOverdue(inv: ReportInvoice): boolean {
  return !!inv.due_date && inv.due_date < TODAY && inv.status !== 'paid'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReportsClient() {
  const [invoices, setInvoices] = useState<ReportInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<Preset>('this-year')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const range = useMemo(() => {
    if (preset === 'custom') {
      return { from: customFrom, to: customTo }
    }
    return getPresetRange(preset)
  }, [preset, customFrom, customTo])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('invoices')
      .select('id, invoice_number, client_name, client_company, total, currency, status, issue_date, due_date, tax_rate')
      .order('issue_date', { ascending: false })
      .then(({ data }) => {
        setInvoices(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    const { from, to } = range
    if (!from || !to) return []
    return invoices.filter((inv) => {
      const d = inv.issue_date
      return d >= from && d <= to
    })
  }, [invoices, range])

  // Derive primary currency (most common among filtered invoices, fallback NGN)
  const primaryCurrency = useMemo(() => {
    if (filtered.length === 0) return 'NGN'
    const counts: Record<string, number> = {}
    for (const inv of filtered) {
      counts[inv.currency] = (counts[inv.currency] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  }, [filtered])

  const totalInvoiced = useMemo(() => filtered.reduce((s, i) => s + (i.total || 0), 0), [filtered])
  const totalCollected = useMemo(() => filtered.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0), [filtered])
  const outstanding = totalInvoiced - totalCollected
  const totalTaxCollected = useMemo(() =>
    filtered.filter(i => i.status === 'paid').reduce((s, i) => s + calcTaxAmount(i.total || 0, i.tax_rate || 0), 0),
    [filtered]
  )

  const subtotalInvoiceTotal = useMemo(() => filtered.reduce((s, i) => s + (i.total || 0), 0), [filtered])
  const subtotalTax = useMemo(() => filtered.reduce((s, i) => s + calcTaxAmount(i.total || 0, i.tax_rate || 0), 0), [filtered])
  const subtotalAmountPaid = useMemo(() => filtered.reduce((s, i) => s + (i.status === 'paid' ? i.total || 0 : 0), 0), [filtered])

  function handleExportCSV() {
    const { from, to } = range
    const headers = ['Invoice #', 'Client', 'Date', 'Invoice Total', 'Tax Amount', 'Status', 'Amount Paid']
    const rows = filtered.map((inv) => {
      const taxAmt = calcTaxAmount(inv.total || 0, inv.tax_rate || 0)
      const amountPaid = inv.status === 'paid' ? inv.total || 0 : 0
      const statusLabel = isOverdue(inv) ? 'Overdue' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)
      return [
        inv.invoice_number,
        inv.client_name || '',
        formatDate(inv.issue_date),
        (inv.total || 0).toFixed(2),
        taxAmt.toFixed(2),
        statusLabel,
        amountPaid.toFixed(2),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`)
       .join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `billbydab-report-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-400 text-sm">Loading report...</div>
  }

  return (
    <>
      {/* Date range filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPreset(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                preset === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === 'custom' ? (
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            {formatDate(range.from)} &ndash; {formatDate(range.to)}
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 mb-1">Total Invoiced</p>
          <p className="text-xl md:text-2xl font-bold text-indigo-600">
            {fmt(totalInvoiced, primaryCurrency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 mb-1">Total Collected</p>
          <p className="text-xl md:text-2xl font-bold text-green-600">
            {fmt(totalCollected, primaryCurrency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{filtered.filter(i => i.status === 'paid').length} paid</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 mb-1">Outstanding</p>
          <p className="text-xl md:text-2xl font-bold text-orange-500">
            {fmt(outstanding, primaryCurrency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{filtered.filter(i => i.status !== 'paid').length} unpaid</p>
        </div>
        <div className="col-span-2 md:col-span-1 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 mb-1">Tax Collected</p>
          <p className="text-xl md:text-2xl font-bold text-blue-600">
            {fmt(totalTaxCollected, primaryCurrency)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">from paid invoices</p>
        </div>
      </div>

      {/* Breakdown table + export */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Invoice Breakdown
            {filtered.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({filtered.length} invoice{filtered.length !== 1 ? 's' : ''})</span>}
          </h2>
          <button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 md:p-12 text-center text-sm text-gray-400">
            No invoices found for the selected period.
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((inv) => {
                const taxAmt = calcTaxAmount(inv.total || 0, inv.tax_rate || 0)
                const amountPaid = inv.status === 'paid' ? inv.total || 0 : 0
                const overdue = isOverdue(inv)
                const statusLabel = overdue ? 'Overdue' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)
                const badgeClass = overdue ? 'bg-red-100 text-red-600' : STATUS_BADGE[inv.status] || STATUS_BADGE.draft
                return (
                  <div key={inv.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{inv.invoice_number}</p>
                        <p className="text-sm text-gray-600">{inv.client_name || '—'}</p>
                        {inv.client_company && <p className="text-xs text-gray-400">{inv.client_company}</p>}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>{statusLabel}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>{formatDate(inv.issue_date)}</span>
                      <div className="text-right">
                        <p>Total: <span className="font-medium text-gray-900">{fmt(inv.total || 0, inv.currency)}</span></p>
                        {taxAmt > 0 && <p>Tax: {fmt(taxAmt, inv.currency)}</p>}
                        <p>Paid: <span className="font-medium text-green-600">{fmt(amountPaid, inv.currency)}</span></p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {/* Mobile subtotals */}
              <div className="p-4 bg-gray-50 flex justify-between text-xs font-semibold text-gray-700">
                <span>Subtotals ({filtered.length})</span>
                <div className="text-right space-y-0.5">
                  <p>Total: {fmt(subtotalInvoiceTotal, primaryCurrency)}</p>
                  <p>Tax: {fmt(subtotalTax, primaryCurrency)}</p>
                  <p>Paid: {fmt(subtotalAmountPaid, primaryCurrency)}</p>
                </div>
              </div>
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                    <th className="text-left px-6 py-3">Invoice #</th>
                    <th className="text-left px-6 py-3">Client</th>
                    <th className="text-left px-6 py-3">Date</th>
                    <th className="text-right px-6 py-3">Invoice Total</th>
                    <th className="text-right px-6 py-3">Tax Amount</th>
                    <th className="text-center px-6 py-3">Status</th>
                    <th className="text-right px-6 py-3">Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv, idx) => {
                    const taxAmt = calcTaxAmount(inv.total || 0, inv.tax_rate || 0)
                    const amountPaid = inv.status === 'paid' ? inv.total || 0 : 0
                    const overdue = isOverdue(inv)
                    const statusLabel = overdue ? 'Overdue' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)
                    const badgeClass = overdue ? 'bg-red-100 text-red-600' : STATUS_BADGE[inv.status] || STATUS_BADGE.draft
                    return (
                      <tr
                        key={inv.id}
                        className={`border-b border-gray-50 last:border-0 transition ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'} hover:bg-indigo-50/30`}
                      >
                        <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                        <td className="px-6 py-3.5 text-sm text-gray-600">
                          <div>{inv.client_name || '—'}</div>
                          {inv.client_company && <div className="text-xs text-gray-400">{inv.client_company}</div>}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-500">{formatDate(inv.issue_date)}</td>
                        <td className="px-6 py-3.5 text-sm font-medium text-gray-900 text-right">{fmt(inv.total || 0, inv.currency)}</td>
                        <td className="px-6 py-3.5 text-sm text-gray-600 text-right">{taxAmt > 0 ? fmt(taxAmt, inv.currency) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-6 py-3.5 text-center">
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${badgeClass}`}>{statusLabel}</span>
                        </td>
                        <td className="px-6 py-3.5 text-sm font-medium text-right">
                          {amountPaid > 0
                            ? <span className="text-green-600">{fmt(amountPaid, inv.currency)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Subtotals row */}
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200 text-sm font-semibold text-gray-700">
                    <td className="px-6 py-3.5" colSpan={3}>
                      Subtotals <span className="font-normal text-gray-400 text-xs">({filtered.length} invoice{filtered.length !== 1 ? 's' : ''})</span>
                    </td>
                    <td className="px-6 py-3.5 text-right">{fmt(subtotalInvoiceTotal, primaryCurrency)}</td>
                    <td className="px-6 py-3.5 text-right">{fmt(subtotalTax, primaryCurrency)}</td>
                    <td></td>
                    <td className="px-6 py-3.5 text-right text-green-600">{fmt(subtotalAmountPaid, primaryCurrency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
