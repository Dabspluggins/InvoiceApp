'use client'

import { useState, useEffect } from 'react'
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
  total: number
  currency: Currency
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  notes: string | null
  is_recurring: boolean
  share_token: string | null
  reminders_sent: number | null
}

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
}

const TODAY = new Date().toISOString().split('T')[0]

function isOverdue(inv: Invoice): boolean {
  return !!inv.due_date && inv.due_date < TODAY && inv.status !== 'paid'
}

function formatDateLong(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function DashboardClient({ user }: { user?: User | null }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [remindingIds, setRemindingIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; color: 'green' | 'indigo' } | null>(null)
  const router = useRouter()

  async function handleCopyLink(inv: Invoice) {
    if (!inv.share_token) return
    await navigator.clipboard.writeText(`https://www.billbydab.com/i/${inv.share_token}`)
    setCopiedId(inv.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  useEffect(() => {
    loadInvoices()
    loadTemplates()
  }, [])

  async function loadInvoices() {
    const supabase = createClient()
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, client_name, client_company, total, currency, status, issue_date, due_date, notes, is_recurring, share_token, reminders_sent')
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

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">Loading invoices...</div>
    )
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {displayName}! 👋</h1>
        <p className="text-gray-500 mt-1">Here&apos;s your invoice overview.</p>
      </div>

      {/* Stats — 2 columns on mobile, 3 on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 mb-1">Total Invoices</p>
          <p className="text-xl md:text-2xl font-bold text-blue-600">{totalInvoices}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 mb-1">Paid</p>
          <p className="text-xl md:text-2xl font-bold text-green-600">{paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="col-span-2 md:col-span-1 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 mb-1">Outstanding</p>
          <p className="text-xl md:text-2xl font-bold text-orange-500">{outstandingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
      </div>

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

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 md:p-12 text-center">
          <div className="text-5xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No invoices yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Create your first invoice and it will appear here.
          </p>
          <Link
            href="/invoice"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Create Invoice
          </Link>
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
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer"
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
                      <p className="text-sm font-semibold text-gray-900 flex items-center gap-1 flex-wrap">
                        {inv.invoice_number}
                        {inv.is_recurring && <span title="Recurring">🔄</span>}
                        {isOverdue(inv) && (
                          <span className="text-xs font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">OVERDUE</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">{inv.client_name || '—'}</p>
                      {inv.client_company && (
                        <p className="text-xs text-gray-400">{inv.client_company}</p>
                      )}
                      {(inv.reminders_sent ?? 0) > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">{inv.reminders_sent} reminder{inv.reminders_sent === 1 ? '' : 's'} sent</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {formatCurrency(inv.total, inv.currency)}
                  </p>
                </div>
                <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">{formatDateLong(inv.issue_date)}</span>
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
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
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
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 transition cursor-pointer group ${selectedIds.has(inv.id) ? 'bg-indigo-50/40' : ''}`}
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
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {inv.invoice_number}
                        {inv.is_recurring && <span title="Recurring">🔄</span>}
                        {isOverdue(inv) && (
                          <span className="text-xs font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">OVERDUE</span>
                        )}
                      </span>
                      {(inv.reminders_sent ?? 0) > 0 && (
                        <span className="text-xs text-gray-400">{inv.reminders_sent} reminder{inv.reminders_sent === 1 ? '' : 's'} sent</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>{inv.client_name || '—'}</div>
                      {inv.client_company && (
                        <div className="text-xs text-gray-400">{inv.client_company}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDateLong(inv.issue_date)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(inv.total, inv.currency)}
                    </td>
                    <td
                      className="px-6 py-4 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {inv.status === 'paid' ? (
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          PAID
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
        <h2 className="text-lg font-bold text-gray-900 mb-4">Templates</h2>
        {templates.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No templates yet</h3>
            <p className="text-gray-500 text-sm">
              Save an invoice as a template and it will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden flex flex-col gap-3">
              {templates.map((tmpl) => (
                <div key={tmpl.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{tmpl.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
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
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-6 py-3">Saved</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tmpl) => (
                    <tr
                      key={tmpl.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{tmpl.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
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
