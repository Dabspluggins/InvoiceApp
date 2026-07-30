'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrencySymbol } from '@/lib/currencies'
import { InvoiceStatus, Currency } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

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
  credit_applied: number | null
}

interface Payment {
  invoice_id: string
  amount: number
  paid_at: string
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
  partial: 'bg-purple-100 text-purple-700',
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
  return total * taxRate / (100 + taxRate)
}

function fmt(amount: number, currency: string) {
  const symbol = getCurrencySymbol(currency)
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtShort(amount: number, currency: string) {
  const symbol = getCurrencySymbol(currency)
  if (amount >= 1_000_000_000) return `${symbol}${(amount / 1_000_000_000).toFixed(2)}B`
  if (amount >= 1_000_000)     return `${symbol}${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000)         return `${symbol}${(amount / 1_000).toFixed(2)}K`
  return `${symbol}${amount.toFixed(2)}`
}

function isOverdue(inv: ReportInvoice): boolean {
  return (
    !!inv.due_date &&
    inv.due_date < TODAY &&
    (inv.status === 'sent' || inv.status === 'pending' || inv.status === 'partial')
  )
}

function getAmountPaid(inv: ReportInvoice, paidMap: Map<string, number>): number {
  if (inv.status === 'paid') return inv.total || 0
  if (inv.status === 'partial') {
    return (paidMap.get(inv.id) || 0) + (inv.credit_applied || 0)
  }
  return 0
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReportsClient() {
  const [invoices, setInvoices] = useState<ReportInvoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
    Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, client_name, client_company, total, currency, status, issue_date, due_date, tax_rate, credit_applied')
        .order('issue_date', { ascending: false }),
      supabase
        .from('payments')
        .select('invoice_id, amount, paid_at'),
    ]).then(([invRes, payRes]) => {
      if (invRes.error || payRes.error) {
        setError(invRes.error?.message || payRes.error?.message || 'Failed to load report data')
        setLoading(false)
        return
      }
      setInvoices(invRes.data || [])
      setPayments(payRes.data || [])
      setLoading(false)
    })
  }, [])

  // Invoices issued within the selected date range
  const filtered = useMemo(() => {
    const { from, to } = range
    if (!from || !to) return []
    return invoices.filter((inv) => {
      const d = inv.issue_date
      return d >= from && d <= to
    })
  }, [invoices, range])

  // Full invoice lookup by id — used for currency and tax rate attribution on payments
  const invoiceMap = useMemo(() => {
    const map = new Map<string, ReportInvoice>()
    for (const inv of invoices) map.set(inv.id, inv)
    return map
  }, [invoices])

  // Payments received within the selected date range (cash-basis window)
  const paymentsInPeriod = useMemo(() => {
    const { from, to } = range
    if (!from || !to) return []
    return payments.filter(p => p.paid_at >= from && p.paid_at <= to)
  }, [payments, range])

  // Monthly breakdown — invoiced (by issue_date) and collected (by paid_at) per calendar month
  // within the selected date range. Only meaningful when the range spans 2+ months.
  // Uses paymentsInPeriod (not the full ledger) so custom ranges like Mar 15–Apr 10 only
  // count cash received within the actual window, matching the KPI cards.
  const monthlyBreakdown = useMemo(() => {
    const { from, to } = range
    if (!from || !to) return []
    const startYear = new Date(from + 'T00:00:00').getFullYear()
    const endYear = new Date(to + 'T00:00:00').getFullYear()
    const multiYear = startYear !== endYear
    const months: { key: string; label: string }[] = []
    const cur = new Date(from + 'T00:00:00')
    cur.setDate(1)
    const endMs = new Date(to + 'T00:00:00').getTime()
    while (cur.getTime() <= endMs) {
      const key = cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0')
      const monthName = cur.toLocaleString('en-US', { month: 'short' })
      const label = multiYear ? monthName + " '" + String(cur.getFullYear()).slice(-2) : monthName
      months.push({ key, label })
      cur.setMonth(cur.getMonth() + 1)
    }
    return months.map(({ key, label }) => ({
      label,
      invoiced: filtered
        .filter(inv => (inv.issue_date ?? '').slice(0, 7) === key)
        .reduce((s, inv) => s + (inv.total || 0), 0),
      collected: paymentsInPeriod
        .filter(p => (p.paid_at ?? '').slice(0, 7) === key)
        .reduce((s, p) => s + p.amount, 0),
    }))
  }, [filtered, paymentsInPeriod, range])

  // Dominant currency from the combined set of invoice currencies (filtered by issue_date)
  // AND payment currencies (filtered by paid_at) — so a period with only payments
  // on older invoices still picks the correct currency rather than falling back to NGN
  const primaryCurrency = useMemo((): Currency => {
    const counts: Record<string, number> = {}
    for (const inv of filtered) {
      counts[inv.currency] = (counts[inv.currency] || 0) + 1
    }
    for (const p of paymentsInPeriod) {
      const c = invoiceMap.get(p.invoice_id)?.currency
      if (c) counts[c] = (counts[c] || 0) + 1
    }
    const entries = Object.entries(counts)
    if (entries.length === 0) return 'NGN'
    return entries.sort((a, b) => b[1] - a[1])[0][0] as Currency
  }, [filtered, paymentsInPeriod, invoiceMap])

  // Mixed-currency if invoice currencies OR payment currencies span more than one currency
  const hasMixedCurrencies = useMemo(() => {
    const currencies = new Set(filtered.map(i => i.currency))
    for (const p of paymentsInPeriod) {
      const c = invoiceMap.get(p.invoice_id)?.currency
      if (c) currencies.add(c)
    }
    return currencies.size > 1
  }, [filtered, paymentsInPeriod, invoiceMap])

  // Payment amounts per invoice from the full payments ledger (for getAmountPaid)
  const paymentsByInvoice = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of payments) {
      map.set(p.invoice_id, (map.get(p.invoice_id) || 0) + p.amount)
    }
    return map
  }, [payments])

  const totalInvoiced = useMemo(() => filtered.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.total || 0), 0), [filtered])

  // Cash-basis: sum payments received in the period
  const totalCollected = useMemo(() =>
    paymentsInPeriod.reduce((s, p) => s + p.amount, 0),
    [paymentsInPeriod]
  )

  const totalOutstanding = useMemo(() =>
    filtered
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((s, i) => s + Math.max(0, (i.total || 0) - getAmountPaid(i, paymentsByInvoice)), 0),
    [filtered, paymentsByInvoice]
  )

  // Cash-basis tax: extract tax proportionally from each payment in the period
  // tax_rate is stored as a percentage (e.g. 7.5); invoice totals are tax-inclusive
  // so tax embedded in a payment = payment.amount * rate / (100 + rate)
  const totalTaxCollected = useMemo(() =>
    paymentsInPeriod.reduce((s, p) => {
      const inv = invoiceMap.get(p.invoice_id)
      if (!inv || !inv.tax_rate || inv.tax_rate <= 0) return s
      return s + p.amount * inv.tax_rate / (100 + inv.tax_rate)
    }, 0),
    [paymentsInPeriod, invoiceMap]
  )

  const subtotalInvoiceTotal = useMemo(() => filtered.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.total || 0), 0), [filtered])
  const subtotalTax = useMemo(() => filtered.filter(i => i.status !== 'cancelled').reduce((s, i) => s + calcTaxAmount(i.total || 0, i.tax_rate || 0), 0), [filtered])
  const subtotalAmountPaid = useMemo(() =>
    filtered.reduce((s, i) => s + getAmountPaid(i, paymentsByInvoice), 0),
    [filtered, paymentsByInvoice]
  )

  function handleExportCSV() {
    const { from, to } = range
    const headers = ['Invoice #', 'Client', 'Date', 'Currency', 'Invoice Total', 'Tax Amount', 'Status', 'Amount Paid']
    const rows = filtered.map((inv) => {
      const taxAmt = calcTaxAmount(inv.total || 0, inv.tax_rate || 0)
      const amountPaid = getAmountPaid(inv, paymentsByInvoice)
      const statusLabel = isOverdue(inv) ? 'Overdue' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)
      return [
        inv.invoice_number,
        inv.client_name || '',
        formatDate(inv.issue_date),
        inv.currency,
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
    a.download = `vortali-report-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">Loading report...</div>
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
        <p className="text-sm font-medium text-red-600 dark:text-red-400">Failed to load report</p>
        <p className="text-xs text-red-500 dark:text-red-500 mt-1">{error}</p>
      </div>
    )
  }

  return (
    <>
      {/* Date range filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6 mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPreset(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                preset === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === 'custom' ? (
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 dark:text-gray-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 dark:text-gray-200"
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {formatDate(range.from)} {'–'} {formatDate(range.to)}
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">Total Invoiced</p>
          {hasMixedCurrencies ? (
            <p className="text-base font-bold text-indigo-600">Multiple currencies</p>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-indigo-600">
              {fmtShort(totalInvoiced, primaryCurrency)}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{filtered.length} invoice{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">Total Collected</p>
          {hasMixedCurrencies ? (
            <p className="text-base font-bold text-green-600">Multiple currencies</p>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-green-600">
              {fmtShort(totalCollected, primaryCurrency)}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">cash received this period</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">Outstanding</p>
          {hasMixedCurrencies ? (
            <p className="text-base font-bold text-orange-500">Multiple currencies</p>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-orange-500">
              {fmtShort(totalOutstanding, primaryCurrency)}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{filtered.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length} unpaid</p>
        </div>
        <div className="col-span-2 md:col-span-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">Tax Collected</p>
          {hasMixedCurrencies ? (
            <p className="text-base font-bold text-blue-600">Multiple currencies</p>
          ) : (
            <p className="text-xl md:text-2xl font-bold text-blue-600">
              {fmtShort(totalTaxCollected, primaryCurrency)}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">cash received this period</p>
        </div>
      </div>

      {/* Monthly Breakdown Bar Chart — only shown when range spans 2+ months */}
      {monthlyBreakdown.length >= 2 && !hasMixedCurrencies && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 md:p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Monthly Breakdown</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Invoiced vs collected per month in selected period</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyBreakdown} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
                  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K'
                  return String(v)
                }}
              />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                formatter={(value, name) => [
                  fmtShort(Number(value), primaryCurrency),
                  name === 'invoiced' ? 'Invoiced' : 'Collected',
                ]}
              />
              <Legend
                iconType="square"
                iconSize={10}
                formatter={(value) => (
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    {value === 'invoiced' ? 'Invoiced' : 'Collected'}
                  </span>
                )}
              />
              <Bar dataKey="invoiced" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="collected" fill="#22c55e" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Breakdown table + export */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Invoice Breakdown
            {filtered.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">({filtered.length} invoice{filtered.length !== 1 ? 's' : ''})</span>}
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
          <div className="p-8 md:p-12 text-center text-sm text-gray-400 dark:text-gray-500">
            No invoices found for the selected period.
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((inv) => {
                const taxAmt = calcTaxAmount(inv.total || 0, inv.tax_rate || 0)
                const amountPaid = getAmountPaid(inv, paymentsByInvoice)
                const overdue = isOverdue(inv)
                const statusLabel = overdue ? 'Overdue' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)
                const badgeClass = overdue ? 'bg-red-100 text-red-600' : STATUS_BADGE[inv.status] || STATUS_BADGE.draft
                return (
                  <div key={inv.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{inv.invoice_number}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{inv.client_name || '—'}</p>
                        {inv.client_company && <p className="text-xs text-gray-400 dark:text-gray-500">{inv.client_company}</p>}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>{statusLabel}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <span>{formatDate(inv.issue_date)}</span>
                      <div className="text-right">
                        <p>Total: <span className="font-medium text-gray-900 dark:text-white">{fmt(inv.total || 0, inv.currency)}</span></p>
                        {taxAmt > 0 && <p>Tax: {fmt(taxAmt, inv.currency)}</p>}
                        <p>Paid: <span className="font-medium text-green-600">{fmt(amountPaid, inv.currency)}</span></p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {/* Mobile subtotals */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-200">
                <span>Subtotals ({filtered.length})</span>
                <div className="text-right space-y-0.5">
                  {hasMixedCurrencies ? (
                    <p className="font-normal text-gray-400 dark:text-gray-500">Multiple currencies — see rows</p>
                  ) : (
                    <>
                      <p>Total: {fmt(subtotalInvoiceTotal, primaryCurrency)}</p>
                      <p>Tax: {fmt(subtotalTax, primaryCurrency)}</p>
                      <p>Paid: {fmt(subtotalAmountPaid, primaryCurrency)}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-700">
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
                    const amountPaid = getAmountPaid(inv, paymentsByInvoice)
                    const overdue = isOverdue(inv)
                    const statusLabel = overdue ? 'Overdue' : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)
                    const badgeClass = overdue ? 'bg-red-100 text-red-600' : STATUS_BADGE[inv.status] || STATUS_BADGE.draft
                    return (
                      <tr
                        key={inv.id}
                        className={`border-b border-gray-50 dark:border-gray-700 last:border-0 transition ${idx % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-700/50' : 'bg-white dark:bg-gray-800'} hover:bg-indigo-50/30 dark:hover:bg-gray-700`}
                      >
                        <td className="px-6 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{inv.invoice_number}</td>
                        <td className="px-6 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                          <div>{inv.client_name || '—'}</div>
                          {inv.client_company && <div className="text-xs text-gray-400 dark:text-gray-500">{inv.client_company}</div>}
                        </td>
                        <td className="px-6 py-3.5 text-sm text-gray-500 dark:text-gray-400">{formatDate(inv.issue_date)}</td>
                        <td className="px-6 py-3.5 text-sm font-medium text-gray-900 dark:text-white text-right">{fmt(inv.total || 0, inv.currency)}</td>
                        <td className="px-6 py-3.5 text-sm text-gray-600 dark:text-gray-300 text-right">{taxAmt > 0 ? fmt(taxAmt, inv.currency) : <span className="text-gray-300 dark:text-gray-600">{'—'}</span>}</td>
                        <td className="px-6 py-3.5 text-center">
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${badgeClass}`}>{statusLabel}</span>
                        </td>
                        <td className="px-6 py-3.5 text-sm font-medium text-right">
                          {amountPaid > 0
                            ? <span className="text-green-600">{fmt(amountPaid, inv.currency)}</span>
                            : <span className="text-gray-300 dark:text-gray-600">{'—'}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <td className="px-6 py-3.5" colSpan={3}>
                      Subtotals <span className="font-normal text-gray-400 dark:text-gray-500 text-xs">({filtered.length} invoice{filtered.length !== 1 ? 's' : ''})</span>
                    </td>
                    {hasMixedCurrencies ? (
                      <td className="px-6 py-3.5 text-right text-gray-400 dark:text-gray-500 text-xs font-normal" colSpan={4}>
                        Multiple currencies {'—'} see individual rows
                      </td>
                    ) : (
                      <>
                        <td className="px-6 py-3.5 text-right">{fmt(subtotalInvoiceTotal, primaryCurrency)}</td>
                        <td className="px-6 py-3.5 text-right">{fmt(subtotalTax, primaryCurrency)}</td>
                        <td></td>
                        <td className="px-6 py-3.5 text-right text-green-600">{fmt(subtotalAmountPaid, primaryCurrency)}</td>
                      </>
                    )}
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
