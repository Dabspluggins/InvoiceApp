'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getCurrencySymbol } from '@/lib/currencies'
import { InvoiceStatus } from '@/lib/types'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts'

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_company: string
  total: number
  currency: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  created_at: string
  paid_at: string | null
}

interface Payment {
  amount: number
  paid_at: string
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

function getLast12Months() {
  const months = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
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
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, client_name, client_company, total, currency, status, issue_date, due_date, created_at, paid_at'),
      supabase
        .from('payments')
        .select('amount, paid_at'),
    ]).then(([{ data: invData }, { data: payData }]) => {
      setInvoices(invData || [])
      setPayments(payData || [])
      setLoading(false)
    })
  }, [])

  // Fix 2: skeleton loading screen matching KPI card layout
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 p-4 md:p-6">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-32" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 p-5 md:p-6 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6" />
          <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)

  // KPIs
  const totalInvoiced = invoices.filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + (i.total || 0), 0)
  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.total || 0), 0)
  const outstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'pending')
    .reduce((sum, i) => sum + (i.total || 0), 0)
  const overdueInvoices = invoices.filter(
    i => i.due_date && i.due_date < today && i.status !== 'paid' && i.status !== 'cancelled'
  )
  const overdueTotal = overdueInvoices.reduce((sum, i) => sum + (i.total || 0), 0)

  // Monthly trend — last 12 months
  const months = getLast12Months()
  const monthlyData = months.map(({ key, label }) => {
    const created = invoices.filter(i => monthKey(i.created_at) === key)
    // Aggregate from payment ledger so partial payments land in the month they were collected
    const collectedInMonth = payments
      .filter(p => monthKey(p.paid_at) === key)
      .reduce((s, p) => s + (p.amount || 0), 0)
    return {
      label,
      invoiced: created.reduce((s, i) => s + (i.total || 0), 0),
      paid: collectedInMonth,
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

  // Currency guard for paid revenue only — drafts/unpaid excluded so they
  // don't incorrectly suppress currency formatting in the top-clients chart
  const paidCurrencySet = new Set(invoices.filter(i => i.status === 'paid').map(i => i.currency))
  const hasMixedPaidCurrencies = paidCurrencySet.size > 1
  const primaryPaidCurrency = hasMixedPaidCurrencies ? 'NGN' : (invoices.find(i => i.status === 'paid')?.currency ?? 'NGN')

  // Invoice status breakdown for PieChart (non-overlapping segments)
  const statusSegments = [
    {
      name: 'Draft',
      color: '#9ca3af',
      invoices: invoices.filter(i => i.status === 'draft'),
    },
    {
      name: 'Paid',
      color: '#22c55e',
      invoices: invoices.filter(i => i.status === 'paid'),
    },
    {
      name: 'Partial',
      color: '#6366f1',
      invoices: invoices.filter(i => i.status === 'partial' && !(i.due_date && i.due_date < today)),
    },
    {
      name: 'Unpaid',
      color: '#f97316',
      invoices: invoices.filter(i => (i.status === 'sent' || i.status === 'pending') && !(i.due_date && i.due_date < today)),
    },
    {
      name: 'Overdue',
      color: '#ef4444',
      invoices: invoices.filter(i => i.due_date && i.due_date < today && i.status !== 'paid' && i.status !== 'draft' && i.status !== 'cancelled'),
    },
    {
      name: 'Cancelled',
      color: '#9ca3af',
      invoices: invoices.filter(i => i.status === 'cancelled'),
    },
  ].map(s => ({
    name: s.name,
    color: s.color,
    count: s.invoices.length,
    value: s.invoices.reduce((sum, i) => sum + (i.total || 0), 0),
  })).filter(s => s.count > 0)

  // Currency guard for value totals in the donut legend
  const hasMixedCurrencies = new Set(invoices.map(i => i.currency)).size > 1
  const primaryCurrency = hasMixedCurrencies ? 'NGN' : (invoices[0]?.currency ?? 'NGN')



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
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Revenue Trend</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Last 12 months — invoiced vs paid</p>
        <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-indigo-500 inline-block" />
            Invoiced
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-green-500 inline-block" />
            Paid
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradInvoiced" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              width={44}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
              formatter={(value, name) => [
                fmt(Number(value)),
                name === 'invoiced' ? 'Invoiced' : 'Paid',
              ]}
            />
            <Area
              type="monotone"
              dataKey="invoiced"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#gradInvoiced)"
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1' }}
            />
            <Area
              type="monotone"
              dataKey="paid"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#gradPaid)"
              dot={false}
              activeDot={{ r: 4, fill: '#22c55e' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Invoice Status Donut */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 md:p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Invoice Status</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Breakdown by status across all invoices</p>
        {statusSegments.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">No invoices yet</p>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="shrink-0">
              <PieChart width={200} height={200}>
                <Pie
                  data={statusSegments}
                  cx={100}
                  cy={100}
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="count"
                  strokeWidth={2}
                >
                  {statusSegments.map((seg, i) => (
                    <Cell key={i} fill={seg.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} invoice${Number(value) !== 1 ? 's' : ''}`, name]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
              </PieChart>
            </div>
            <ul className="flex-1 space-y-3 w-full">
              {statusSegments.map(seg => (
                <li key={seg.name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                    {seg.name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {seg.count} invoice{seg.count !== 1 ? 's' : ''}
                  </span>
                  {!hasMixedCurrencies && (
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {fmtWithCurrency(seg.value, primaryCurrency)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
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
          ) : hasMixedPaidCurrencies ? (
            // Fix 1: suppress chart when paid revenue spans currencies — cross-currency
            // ranking and bar sizing would be meaningless
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">
              Multiple currencies — revenue ranking not available
            </p>
          ) : (
            <div className="p-5">
              <ResponsiveContainer width="100%" height={topClients.length * 48 + 16}>
                <BarChart
                  layout="vertical"
                  data={topClients.map(([name, revenue]) => ({ name, revenue }))}
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                  barSize={16}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => {
                      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                      if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
                      return String(v)
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) => {
                      const label = payload.value.length > 18 ? payload.value.slice(0, 17) + '…' : payload.value
                      return (
                        <text x={Number(x)} y={Number(y)} fill="#6b7280" fontSize={11} textAnchor="end" dominantBaseline="middle">
                          {label}
                        </text>
                      )
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value) => [fmtWithCurrency(Number(value), primaryPaidCurrency), 'Revenue']}
                    labelFormatter={(label) => label}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                    cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {topClients.map(([name], i) => (
                      <Cell key={name} fill={i === 0 ? '#22c55e' : i === 1 ? '#4ade80' : '#86efac'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
