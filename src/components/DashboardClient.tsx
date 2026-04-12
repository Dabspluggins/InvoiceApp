'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { InvoiceStatus, Currency } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_company: string
  business_name: string | null
  total: number
  currency: Currency
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  notes: string | null
  is_recurring: boolean
  share_token: string | null
  reminders_sent: number | null
  viewed_at: string | null
  view_count: number | null
  payments?: { amount: number }[]
}

type StatusFilter = 'all' | 'unpaid' | 'paid' | 'overdue' | 'partial'

interface Template {
  id: string
  name: string
  created_at: string
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-purple-100 text-purple-700',
}

const TODAY = new Date().toISOString().split('T')[0]

function getAmountPaid(inv: Invoice): number {
  return (inv.payments || []).reduce((sum, p) => sum + p.amount, 0)
}

function isPartial(inv: Invoice): boolean {
  const paid = getAmountPaid(inv)
  return paid > 0 && paid < inv.total
}

function isOverdue(inv: Invoice): boolean {
  return !!inv.due_date && inv.due_date < TODAY && inv.status !== 'paid'
}

function formatDateLong(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function DashboardClient({ user, darkMode }: { user?: User | null; darkMode?: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [unbilledExpenseTotal, setUnbilledExpenseTotal] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [remindingIds, setRemindingIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; color: 'green' | 'indigo' } | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const router = useRouter()

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter((inv) => {
      // Search filter
      if (q) {
        const name = (inv.client_name || '').toLowerCase()
        const company = (inv.client_company || '').toLowerCase()
        if (!name.includes(q) && !company.includes(q)) return false
      }
      // Status filter
      if (statusFilter === 'paid') return inv.status === 'paid'
      if (statusFilter === 'unpaid') return inv.status === 'sent' || inv.status === 'pending'
      if (statusFilter === 'partial') return isPartial(inv)
      if (statusFilter === 'overdue') {
        const isUnpaid = inv.status === 'sent' || inv.status === 'pending'
        const isPastDue = inv.due_date != null && inv.due_date < TODAY
        return isUnpaid && isPastDue
      }
      return true
    })
  }, [invoices, search, statusFilter])

  async function handleCopyLink(inv: Invoice) {
    if (!inv.share_token) return
    await navigator.clipboard.writeText(`https://www.billbydab.com/i/${inv.share_token}`)
    setCopiedId(inv.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  useEffect(() => {
    loadInvoices()
    loadTemplates()
    loadUnbilledExpenses()
  }, [])

  async function loadUnbilledExpenses() {
    const supabase = createClient()
    const { data } = await supabase
      .from('expenses')
      .select('amount')
      .eq('billable', true)
      .eq('billed', false)
    if (data) {
      setUnbilledExpenseTotal(data.reduce((sum, e) => sum + (e.amount ?? 0), 0))
    }
  }

  async function loadInvoices() {
    const supabase = createClient()
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, client_name, client_company, business_name, total, currency, status, issue_date, due_date, notes, is_recurring, share_token, reminders_sent, viewed_at, view_count, payments(amount)')
      .order('created_at', { ascending: false })

    setInvoices(data || [])
    setLoading(false)
  }

  async function handleStatusChange(id: string, status: InvoiceStatus) {
    const supabase = createClient()
    await supabase.from('invoices').update({ status }).eq('id', id)
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status } : inv)))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('line_items').delete().eq('invoice_id', id)
    await supabase.from('invoices').delete().eq('id', id)
    setInvoices((prev) => prev.filter((inv) => inv.id !== id))
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }

  async function handleSendReminder(id: string) {
    setRemindingIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/invoices/${id}/remind`, { method: 'POST' })
      if (res.ok) {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === id
              ? { ...inv, reminders_sent: (inv.reminders_sent ?? 0) + 1 }
              : inv
          )
        )
      }
    } finally {
      setRemindingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function handleWhatsApp(inv: Invoice) {
    if (!inv.share_token) return
    const shareUrl = `https://www.billbydab.com/i/${inv.share_token}`
    const businessName =
      inv.business_name ||
      user?.user_metadata?.business_name ||
      user?.email ||
      'Your Service Provider'
    const clientName = inv.client_name || 'there'
    const dueDate = inv.due_date
      ? new Date(inv.due_date + 'T00:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'N/A'
    const overdue = isOverdue(inv)
    const message = overdue
      ? `Hi ${clientName},\n\nYour invoice ${inv.invoice_number} for ${formatCurrency(inv.total, inv.currency)} was due on ${dueDate} and remains unpaid.\n\nPlease view and settle your invoice here: ${shareUrl}\n\nThank you,\n${businessName}`
      : `Hi ${clientName},\n\nThis is a friendly reminder that invoice ${inv.invoice_number} for ${formatCurrency(inv.total, inv.currency)} is due on ${dueDate}.\n\nView your invoice here: ${shareUrl}\n\nPlease let us know if you have any questions.\n\n${businessName}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  async function loadTemplates() {
    const supabase = createClient()
    const { data } = await supabase
      .from('templates')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
    setTemplates(data || [])
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('templates').delete().eq('id', id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  function showToast(message: string, color: 'green' | 'indigo') {
    setToast({ message, color })
    setTimeout(() => setToast(null), 3000)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)))
    }
  }

  async function handleBulkMarkPaid() {
    const supabase = createClient()
    const unpaidSelected = invoices.filter(
      (inv) => selectedIds.has(inv.id) && inv.status !== 'paid'
    )
    if (unpaidSelected.length === 0) return

    const results = await Promise.allSettled(
      unpaidSelected.map((inv) =>
        supabase.from('invoices').update({ status: 'paid' as InvoiceStatus }).eq('id', inv.id)
      )
    )

    const successIds = new Set(
      unpaidSelected
        .filter((_, i) => results[i].status === 'fulfilled')
        .map((inv) => inv.id)
    )

    setInvoices((prev) =>
      prev.map((inv) =>
        successIds.has(inv.id) ? { ...inv, status: 'paid' as InvoiceStatus } : inv
      )
    )
    setSelectedIds(new Set())
    showToast(`${successIds.size} invoice${successIds.size !== 1 ? 's' : ''} marked as paid ✓`, 'green')
  }

  function handleExportCSV() {
    const selected = invoices.filter((inv) => selectedIds.has(inv.id))
    const header = 'Invoice Number,Client Name,Client Company,Issue Date,Due Date,Total,Currency,Status,Notes'
    const rows = selected.map((inv) => {
      const cols = [
        inv.invoice_number,
        inv.client_name || '',
        inv.client_company || '',
        formatDateLong(inv.issue_date),
        formatDateLong(inv.due_date),
        inv.total.toFixed(2),
        inv.currency,
        inv.status,
        (inv.notes || '').replace(/"/g, '""'),
      ]
      return cols.map((c) => `"${c}"`).join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `billbydab-invoices-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`${selected.length} invoice${selected.length !== 1 ? 's' : ''} exported ✓`, 'indigo')
  }

  const totalInvoices = invoices.length
  const paidAmount = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.total, 0)
  const outstandingAmount = invoices
    .filter((i) => i.status === 'sent' || i.status === 'pending')
    .reduce((sum, i) => sum + i.total, 0)

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there'

  const hasSelection = selectedIds.size > 0
  const hasUnpaidSelected = invoices.some(
    (inv) => selectedIds.has(inv.id) && inv.status !== 'paid'
  )
  const allSelected = invoices.length > 0 && selectedIds.size === invoices.length

  const STATUS_PILLS: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Unpaid', value: 'unpaid' },
    { label: 'Partial', value: 'partial' },
    { label: 'Paid', value: 'paid' },
    { label: 'Overdue', value: 'overdue' },
  ]

  const dk = darkMode

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">Loading invoices...</div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h1 className={`text-2xl font-bold ${dk ? 'text-white' : 'text-gray-900'}`}>Welcome back, {displayName}! 👋</h1>
        <p className={`mt-1 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>Here&apos;s your invoice overview.</p>
      </div>

      {/* Stats — 2 columns on mobile, 3 on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className={`rounded-xl border p-4 md:p-6 ${dk ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs md:text-sm mb-1 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>Total Invoices</p>
          <p className="text-xl md:text-2xl font-bold text-blue-500">
            {filteredInvoices.length !== totalInvoices
              ? `${filteredInvoices.length} / ${totalInvoices}`
              : totalInvoices}
          </p>
        </div>
        <div className={`rounded-xl border p-4 md:p-6 ${dk ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs md:text-sm mb-1 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>Paid</p>
          <p className="text-xl md:text-2xl font-bold text-green-500">{paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className={`col-span-2 md:col-span-1 rounded-xl border p-4 md:p-6 ${dk ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs md:text-sm mb-1 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>Outstanding</p>
          <p className="text-xl md:text-2xl font-bold text-orange-500">{outstandingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Unbilled expenses banner */}
      {unbilledExpenseTotal !== null && unbilledExpenseTotal > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{formatCurrency(unbilledExpenseTotal, 'NGN')}</span>
              {' '}in unbilled expenses
            </p>
          </div>
          <Link
            href="/expenses"
            className="text-xs text-amber-700 font-semibold hover:text-amber-900 whitespace-nowrap border border-amber-300 hover:border-amber-500 px-3 py-1.5 rounded-lg transition"
          >
            View Expenses →
          </Link>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-3 mb-6">
        <Link
          href="/clients"
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 hover:border-indigo-400 px-4 py-2 rounded-lg transition"
        >
          Manage Clients →
        </Link>
        <Link
          href="/analytics"
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 hover:border-indigo-400 px-4 py-2 rounded-lg transition"
        >
          View Analytics →
        </Link>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client or company…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_PILLS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                statusFilter === value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className={`rounded-xl border p-8 md:p-12 text-center ${dk ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="text-5xl mb-4">📄</div>
          <h3 className={`text-lg font-semibold mb-2 ${dk ? 'text-white' : 'text-gray-900'}`}>No invoices yet</h3>
          <p className={`text-sm mb-6 ${dk ? 'text-gray-400' : 'text-gray-500'}`}>
            Create your first invoice and it will appear here.
          </p>
          <Link
            href="/invoice"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Create Invoice
          </Link>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className={`rounded-xl border p-8 text-center text-sm ${dk ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'}`}>
          No invoices match your search or filter.
        </div>
      ) : (
        <>
          {/* Bulk action bar */}
          {hasSelection && (
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 flex items-center gap-3 mb-3 shadow-sm flex-wrap">
              <span className="text-sm text-gray-700 font-medium">
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleBulkMarkPaid}
                disabled={!hasUnpaidSelected}
                className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-md hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                ✓ Mark as Paid
              </button>
              <button
                onClick={handleExportCSV}
                className="border border-indigo-600 text-indigo-600 text-sm px-3 py-1.5 rounded-md hover:bg-indigo-50 transition"
              >
                ↓ Export CSV
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-gray-400 hover:text-gray-600 ml-auto"
              >
                ✕ Deselect all
              </button>
            </div>
          )}

          {/* Mobile: card list */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className={`rounded-xl border p-4 cursor-pointer ${dk ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                onClick={() => router.push(`/invoice?id=${inv.id}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-2">
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inv.id)}
                        onChange={() => toggleSelect(inv.id)}
                        className="accent-indigo-600 mt-0.5"
                      />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold flex items-center gap-1 flex-wrap ${dk ? 'text-white' : 'text-gray-900'}`}>
                        {inv.invoice_number}
                        {inv.is_recurring && <span title="Recurring">🔄</span>}
                        {isOverdue(inv) && (
                          <span className="text-xs font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">OVERDUE</span>
                        )}
                      </p>
                      <p className={`text-sm mt-0.5 ${dk ? 'text-gray-300' : 'text-gray-600'}`}>{inv.client_name || '—'}</p>
                      {inv.client_company && (
                        <p className={`text-xs ${dk ? 'text-gray-500' : 'text-gray-400'}`}>{inv.client_company}</p>
                      )}
                      {(inv.reminders_sent ?? 0) > 0 && (
                        <p className={`text-xs mt-0.5 ${dk ? 'text-gray-500' : 'text-gray-400'}`}>{inv.reminders_sent} reminder{inv.reminders_sent === 1 ? '' : 's'} sent</p>
                      )}
                      {inv.viewed_at && (
                        <p
                          className="text-xs text-indigo-500 mt-0.5"
                          title={`Last viewed: ${new Date(inv.viewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        >
                          👁 {(inv.view_count ?? 0) > 1 ? `${inv.view_count}×` : 'Viewed'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${dk ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(inv.total, inv.currency)}
                    </p>
                    {isPartial(inv) && (
                      <p className="text-xs text-purple-600 mt-0.5">
                        {formatCurrency(getAmountPaid(inv), inv.currency)} paid
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">{formatDateLong(inv.issue_date)}</span>
                    {inv.status === 'partial' ? (
                      <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full">
                        PARTIAL
                      </span>
                    ) : (
                      <select
                        value={inv.status}
                        onChange={(e) => handleStatusChange(inv.id, e.target.value as InvoiceStatus)}
                        className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer border-0 outline-none ${STATUS_COLORS[inv.status]}`}
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.share_token && (
                      <button
                        onClick={() => handleCopyLink(inv)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
                        title="Copy shareable link"
                      >
                        {copiedId === inv.id ? 'Copied!' : '🔗 Copy link'}
                      </button>
                    )}
                    {isOverdue(inv) && (
                      <button
                        onClick={() => handleSendReminder(inv.id)}
                        disabled={remindingIds.has(inv.id)}
                        className="text-xs text-gray-500 hover:text-indigo-600 font-medium px-2 py-1 border border-gray-200 hover:border-indigo-300 rounded-md transition disabled:opacity-50"
                      >
                        {remindingIds.has(inv.id) ? 'Sending…' : 'Send Reminder'}
                      </button>
                    )}
                    {inv.share_token && inv.status !== 'paid' && (
                      <button
                        onClick={() => handleWhatsApp(inv)}
                        className="inline-flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white font-medium px-2 py-1 rounded-md transition"
                        title="Send WhatsApp reminder"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WA
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/invoice?duplicate=${inv.id}`)}
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-medium px-2 py-1"
                    >
                      ⧉ Duplicate
                    </button>
                    <button
                      onClick={() => handleDelete(inv.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className={`hidden md:block rounded-xl border overflow-hidden ${dk ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <table className="w-full">
              <thead>
                <tr className={`border-b text-xs uppercase tracking-wide ${dk ? 'border-gray-700 text-gray-400 bg-gray-900' : 'border-gray-100 text-gray-500 bg-gray-50'}`}>
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="accent-indigo-600"
                      title="Select all"
                    />
                  </th>
                  <th className="text-left px-6 py-3">Invoice</th>
                  <th className="text-left px-6 py-3">Client</th>
                  <th className="text-left px-6 py-3">Date</th>
                  <th className="text-right px-6 py-3">Amount</th>
                  <th className="text-center px-6 py-3">Status</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`border-b last:border-0 transition cursor-pointer group ${dk ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-50 hover:bg-gray-50'} ${selectedIds.has(inv.id) ? (dk ? 'bg-indigo-900/30' : 'bg-indigo-50/40') : ''}`}
                    onClick={() => router.push(`/invoice?id=${inv.id}`)}
                  >
                    <td
                      className="px-4 py-4 w-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inv.id)}
                        onChange={() => toggleSelect(inv.id)}
                        className="accent-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={selectedIds.has(inv.id) ? { opacity: 1 } : undefined}
                      />
                    </td>
                    <td className={`px-6 py-4 text-sm font-medium ${dk ? 'text-white' : 'text-gray-900'}`}>
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {inv.invoice_number}
                        {inv.is_recurring && <span title="Recurring">🔄</span>}
                        {isOverdue(inv) && (
                          <span className="text-xs font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">OVERDUE</span>
                        )}
                      </span>
                      {(inv.reminders_sent ?? 0) > 0 && (
                        <span className={`text-xs ${dk ? 'text-gray-500' : 'text-gray-400'}`}>{inv.reminders_sent} reminder{inv.reminders_sent === 1 ? '' : 's'} sent</span>
                      )}
                      {inv.viewed_at && (
                        <span
                          className="block text-xs text-indigo-500 mt-0.5"
                          title={`Last viewed: ${new Date(inv.viewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        >
                          👁 {(inv.view_count ?? 0) > 1 ? `${inv.view_count}×` : 'Viewed'}
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-sm ${dk ? 'text-gray-300' : 'text-gray-600'}`}>
                      <div>{inv.client_name || '—'}</div>
                      {inv.client_company && (
                        <div className={`text-xs ${dk ? 'text-gray-500' : 'text-gray-400'}`}>{inv.client_company}</div>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-sm ${dk ? 'text-gray-400' : 'text-gray-500'}`}>{formatDateLong(inv.issue_date)}</td>
                    <td className={`px-6 py-4 text-sm font-medium text-right ${dk ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(inv.total, inv.currency)}
                      {isPartial(inv) && (
                        <div className="text-xs text-purple-600 mt-0.5">
                          {formatCurrency(getAmountPaid(inv), inv.currency)} paid
                        </div>
                      )}
                    </td>
                    <td
                      className="px-6 py-4 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {inv.status === 'paid' ? (
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          PAID
                        </span>
                      ) : inv.status === 'partial' ? (
                        <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          PARTIAL
                        </span>
                      ) : (
                        <select
                          value={inv.status}
                          onChange={(e) =>
                            handleStatusChange(inv.id, e.target.value as InvoiceStatus)
                          }
                          className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer border-0 outline-none ${STATUS_COLORS[inv.status]}`}
                        >
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="paid">Paid</option>
                          <option value="pending">Pending</option>
                        </select>
                      )}
                    </td>
                    <td
                      className="px-6 py-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-3">
                        {inv.share_token && (
                          <button
                            onClick={() => handleCopyLink(inv)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            title="Copy shareable link"
                          >
                            {copiedId === inv.id ? 'Copied!' : '🔗 Copy link'}
                          </button>
                        )}
                        {isOverdue(inv) && (
                          <button
                            onClick={() => handleSendReminder(inv.id)}
                            disabled={remindingIds.has(inv.id)}
                            className="text-xs text-gray-500 hover:text-indigo-600 font-medium border border-gray-200 hover:border-indigo-300 px-2 py-1 rounded-md transition disabled:opacity-50"
                          >
                            {remindingIds.has(inv.id) ? 'Sending…' : 'Send Reminder'}
                          </button>
                        )}
                        {inv.share_token && inv.status !== 'paid' && (
                          <button
                            onClick={() => handleWhatsApp(inv)}
                            className="inline-flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white font-medium px-2 py-1 rounded-md transition"
                            title="Send WhatsApp reminder"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WhatsApp
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/invoice?duplicate=${inv.id}`)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                        >
                          ⧉ Duplicate
                        </button>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Templates section */}
      <div className="mt-10">
        <h2 className={`text-lg font-bold mb-4 ${dk ? 'text-white' : 'text-gray-900'}`}>Templates</h2>
        {templates.length === 0 ? (
          <div className={`rounded-xl border p-8 text-center ${dk ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="text-4xl mb-3">📋</div>
            <h3 className={`text-base font-semibold mb-1 ${dk ? 'text-white' : 'text-gray-900'}`}>No templates yet</h3>
            <p className={`text-sm ${dk ? 'text-gray-400' : 'text-gray-500'}`}>
              Save an invoice as a template and it will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden flex flex-col gap-3">
              {templates.map((tmpl) => (
                <div key={tmpl.id} className={`rounded-xl border p-4 ${dk ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className={`text-sm font-semibold ${dk ? 'text-white' : 'text-gray-900'}`}>{tmpl.name}</p>
                      <p className={`text-xs mt-0.5 ${dk ? 'text-gray-500' : 'text-gray-400'}`}>
                        {new Date(tmpl.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/invoice?template=${tmpl.id}`)}
                      className="flex-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
                    >
                      Use Template
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className={`hidden md:block rounded-xl border overflow-hidden ${dk ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <table className="w-full">
                <thead>
                  <tr className={`border-b text-xs uppercase tracking-wide ${dk ? 'border-gray-700 text-gray-400 bg-gray-900' : 'border-gray-100 text-gray-500 bg-gray-50'}`}>
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-6 py-3">Saved</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tmpl) => (
                    <tr
                      key={tmpl.id}
                      className={`border-b last:border-0 transition ${dk ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-50 hover:bg-gray-50'}`}
                    >
                      <td className={`px-6 py-4 text-sm font-medium ${dk ? 'text-white' : 'text-gray-900'}`}>{tmpl.name}</td>
                      <td className={`px-6 py-4 text-sm ${dk ? 'text-gray-400' : 'text-gray-500'}`}>
                        {new Date(tmpl.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-4">
                        <button
                          onClick={() => router.push(`/invoice?template=${tmpl.id}`)}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700 transition"
                        >
                          Use Template
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg z-50 transition-all ${
            toast.color === 'green' ? 'bg-green-600' : 'bg-indigo-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  )
}
