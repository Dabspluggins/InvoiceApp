'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getCurrencySymbol } from '@/lib/currencies'

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_company: string
  total: number
  currency: string
  status: string
  issue_date: string
  due_date: string
  created_at: string
}

function fmt(amount: number) {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtWithCurrency(amount: number, currency: string) {
  return `${getCurrencySymbol(currency)}${fmt(amount)}`
}

function monthKey(dateStr: string) {
  return dateStr?.slice(0, 7) ?? ''
}

function getLast6Months() {
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-US', { month: 'short' })
    months.push({ key, label })
  }
  return months
}

function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-xl md:text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AnalyticsClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('invoices')
      .select('id, invoice_number, client_name, client_company, total, currency, status, issue_date, due_date, created_at')
      .then(({ data }) => {
        setInvoices(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="text-center py-16 text-gray-400 text-sm">Loading analytics...</div>
  }

  const today = new Date().toISOString().slice(0, 10)

  // KPIs
  const totalInvoiced = invoices.reduce((sum, i) => sum + (i.total || 0), 0)
  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.total || 0), 0)
  const outstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'pending')
    .reduce((sum, i) => sum + (i.total || 0), 0)
  const overdueInvoices = invoices.filter(
    i => i.due_date && i.due_date < today && i.status !== 'paid'
  )
  const overdueTotal = overdueInvoices.reduce((sum, i) => sum + (i.total || 0), 0)

  // Monthly trend — last 6 months
  const months = getLast6Months()
  const monthlyData = months.map(({ key, label }) => {
    const created = invoices.filter(i => monthKey(i.created_at) === key)
    const paid = invoices.filter(i => i.status === 'paid' && monthKey(i.created_at) === key)
    return {
      label,
      invoiced: created.reduce((s, i) => s + (i.total || 0), 0),
      paid: paid.reduce((s, i) => s + (i.total || 0), 0),
    }
  })

  // Top 5 clients by paid revenue
  const clientMap: Record<string, number> = {}
  invoices.filter(i => i.status === 'paid').forEach(i => {
    const name = i.client_name || i.client_company || 'Unknown'
    clientMap[name] = (clientMap[name] || 0) + (i.total || 0)
  })
  const topClients = Object.entries(clientMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // SVG chart constants
  const chartW = 560
  const chartH = 200
  const padL = 60
  const padR = 20
  const padT = 16
  const padB = 30
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - padB
  const maxVal = Math.max(...monthlyData.flatMap(d => [d.invoiced, d.paid]), 1)
  const barGroupW = innerW / months.length
  const barW = Math.min(barGroupW * 0.35, 22)
  const gap = barW * 0.4

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Invoiced" value={fmt(totalInvoiced)} color="text-indigo-600" />
        <KpiCard label="Total Paid" value={fmt(totalPaid)} color="text-green-600" />
        <KpiCard label="Outstanding" value={fmt(outstanding)} color="text-orange-500" />
        <KpiCard
          label="Overdue"
          value={fmt(overdueTotal)}
          color="text-red-600"
          sub={`${overdueInvoices.length} invoice${overdueInvoices.length !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Monthly Trend Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 md:p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Monthly Trend</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Last 6 months — invoiced vs paid</p>
        <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
            Invoiced
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
            Paid
          </span>
        </div>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full max-w-2xl"
            style={{ minWidth: 320 }}
            aria-label="Monthly invoiced vs paid bar chart"
          >
            {/* Y-axis gridlines + labels */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => {
              const y = padT + innerH * (1 - pct)
              const val = maxVal * pct
              return (
                <g key={pct}>
                  <line
                    x1={padL} y1={y} x2={chartW - padR} y2={y}
                    stroke="#f3f4f6" strokeWidth="1"
                  />
                  <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                    {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
                  </text>
                </g>
              )
            })}

            {/* Bars */}
            {monthlyData.map((d, i) => {
              const groupX = padL + i * barGroupW + barGroupW / 2
              const invoicedH = maxVal > 0 ? (d.invoiced / maxVal) * innerH : 0
              const paidH = maxVal > 0 ? (d.paid / maxVal) * innerH : 0
              const x1 = groupX - gap / 2 - barW
              const x2 = groupX + gap / 2
              return (
                <g key={i}>
                  {invoicedH > 0 && (
                    <rect
                      x={x1} y={padT + innerH - invoicedH}
                      width={barW} height={invoicedH}
                      rx="3" fill="#6366f1" opacity="0.85"
                    />
                  )}
                  {paidH > 0 && (
                    <rect
                      x={x2} y={padT + innerH - paidH}
                      width={barW} height={paidH}
                      rx="3" fill="#22c55e" opacity="0.85"
                    />
                  )}
                  <text
                    x={groupX} y={chartH - 6}
                    textAnchor="middle" fontSize="10" fill="#6b7280"
                  >
                    {d.label}
                  </text>
                </g>
              )
            })}

            {/* X-axis baseline */}
            <line
              x1={padL} y1={padT + innerH} x2={chartW - padR} y2={padT + innerH}
              stroke="#e5e7eb" strokeWidth="1"
            />
          </svg>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue invoices table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Overdue Invoices</h2>
          </div>
          {overdueInvoices.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">No overdue invoices</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide bg-gray-50 dark:bg-gray-700">
                    <th className="text-left px-5 py-2.5">Invoice</th>
                    <th className="text-left px-5 py-2.5">Client</th>
                    <th className="text-right px-5 py-2.5">Amount</th>
                    <th className="text-right px-5 py-2.5">Due</th>
                    <th className="text-right px-5 py-2.5">Days Late</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueInvoices
                    .sort((a, b) => a.due_date.localeCompare(b.due_date))
                    .map(inv => {
                      const daysLate = Math.floor(
                        (new Date(today).getTime() - new Date(inv.due_date).getTime()) / 86_400_000
                      )
                      return (
                        <tr key={inv.id} className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                          <td className="px-5 py-3">
                            <Link
                              href={`/invoice?id=${inv.id}`}
                              className="text-indigo-600 hover:underline font-medium"
                            >
                              {inv.invoice_number}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-300 max-w-[120px] truncate">
                            {inv.client_name || inv.client_company || '—'}
                          </td>
                          <td className="px-5 py-3 text-gray-900 dark:text-white font-medium text-right">
                            {fmtWithCurrency(inv.total || 0, inv.currency || 'NGN')}
                          </td>
                          <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-right whitespace-nowrap">
                            {new Date(inv.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-red-600 font-semibold">{daysLate}d</span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top clients by paid revenue */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Top Clients by Revenue</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Based on paid invoices</p>
          </div>
          {topClients.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">No paid invoices yet</p>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-gray-700">
              {topClients.map(([name, amount], i) => (
                <li key={name} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="text-xs font-bold text-gray-300 dark:text-gray-600 w-4 shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{name}</span>
                  <span className="text-sm font-semibold text-green-600">{fmt(amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
