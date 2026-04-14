'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { EstimateStatus, Currency } from '@/lib/types'

interface Estimate {
  id: string
  estimate_number: string
  title: string | null
  client_name: string | null
  client_email: string | null
  status: EstimateStatus
  valid_until: string | null
  total: number
  currency: Currency
  created_at: string
}

const PAGE_SIZE = 20

const STATUS_COLORS: Record<EstimateStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  client_reviewing: 'bg-yellow-100 text-yellow-700',
  revised: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  converted: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  client_reviewing: 'Reviewing',
  revised: 'Revised',
  approved: 'Approved',
  rejected: 'Rejected',
  converted: 'Converted',
}

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Approved', value: 'approved' },
  { label: 'Revised', value: 'revised' },
] as const

type FilterValue = (typeof STATUS_FILTERS)[number]['value']

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-100 rounded w-3/4" />
        </td>
      ))}
    </tr>
  )
}

export default function EstimatesClient() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilterValue>('all')
  const [page, setPage] = useState(0)
  const [toast, setToast] = useState<{ message: string; color: 'green' | 'red' } | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadEstimates()
  }, [])

  async function loadEstimates() {
    const supabase = createClient()
    const { data } = await supabase
      .from('estimates')
      .select(
        'id, estimate_number, title, client_name, client_email, status, valid_until, total, currency, created_at'
      )
      .order('created_at', { ascending: false })
    setEstimates((data as Estimate[]) || [])
    setLoading(false)
  }

  function showToast(message: string, color: 'green' | 'red') {
    setToast({ message, color })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this estimate? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('estimate_line_items').delete().eq('estimate_id', id)
    await supabase.from('estimate_events').delete().eq('estimate_id', id)
    await supabase.from('estimates').delete().eq('id', id)
    setEstimates((prev) => prev.filter((e) => e.id !== id))
    showToast('Estimate deleted.', 'red')
  }

  async function handleSend(est: Estimate) {
    if (!est.client_email) {
      showToast('No client email on this estimate. Open it to add one.', 'red')
      return
    }
    if (
      !confirm(
        `Send estimate ${est.estimate_number} to ${est.client_email}?`
      )
    )
      return
    setSendingId(est.id)
    try {
      const res = await fetch(`/api/estimates/${est.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: est.client_email, toName: est.client_name || '' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to send')
      setEstimates((prev) =>
        prev.map((e) => (e.id === est.id ? { ...e, status: 'sent' as EstimateStatus } : e))
      )
      showToast(`Sent to ${est.client_email}!`, 'green')
    } catch (err) {
      console.error(err)
      showToast('Failed to send. Check RESEND_API_KEY.', 'red')
    } finally {
      setSendingId(null)
    }
  }

  async function handleConvert(est: Estimate) {
    if (!confirm(`Convert estimate ${est.estimate_number} to an invoice?`)) return
    setConvertingId(est.id)
    try {
      const res = await fetch(`/api/estimates/${est.id}/convert`, { method: 'POST' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to convert')
      setEstimates((prev) =>
        prev.map((e) =>
          e.id === est.id ? { ...e, status: 'converted' as EstimateStatus } : e
        )
      )
      showToast('Converted to invoice!', 'green')
      router.push(`/invoice?id=${result.invoiceId}`)
    } catch (err) {
      console.error(err)
      showToast('Conversion failed.', 'red')
    } finally {
      setConvertingId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return estimates.filter((est) => {
      if (q) {
        const name = (est.client_name || '').toLowerCase()
        const num = est.estimate_number.toLowerCase()
        const title = (est.title || '').toLowerCase()
        if (!name.includes(q) && !num.includes(q) && !title.includes(q)) return false
      }
      if (statusFilter !== 'all' && est.status !== statusFilter) return false
      return true
    })
  }, [estimates, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Create and send estimates to clients for approval.
        </p>
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search by client, number, or title…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => { setStatusFilter(value); setPage(0) }}
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

      {/* Empty state */}
      {!loading && estimates.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 md:p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No estimates yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Create your first estimate and send it to a client for review.
          </p>
          <Link
            href="/estimates/new"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Create Estimate
          </Link>
        </div>
      )}

      {!loading && estimates.length > 0 && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
          No estimates match your search or filter.
        </div>
      )}

      {(loading || paginated.length > 0) && (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden flex flex-col gap-3">
            {loading
              ? [1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/3 mb-3" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                  </div>
                ))
              : paginated.map((est) => (
                  <div
                    key={est.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer"
                    onClick={() => router.push(`/estimates/${est.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{est.estimate_number}</p>
                        {est.title && <p className="text-xs text-gray-500 mt-0.5">{est.title}</p>}
                        <p className="text-sm text-gray-600 mt-0.5">{est.client_name || '—'}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(est.total, est.currency)}
                      </p>
                    </div>
                    <div
                      className="flex items-center justify-between gap-2 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[est.status]}`}
                        >
                          {STATUS_LABELS[est.status]}
                        </span>
                        {est.valid_until && (
                          <span className="text-xs text-gray-400">
                            Valid: {formatDateShort(est.valid_until)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {(est.status === 'draft' || est.status === 'sent') && (
                          <button
                            onClick={() => handleSend(est)}
                            disabled={sendingId === est.id}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 border border-blue-200 hover:border-blue-400 rounded-md disabled:opacity-50"
                          >
                            {sendingId === est.id ? 'Sending…' : 'Send'}
                          </button>
                        )}
                        {est.status === 'approved' && (
                          <button
                            onClick={() => handleConvert(est)}
                            disabled={convertingId === est.id}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium px-2 py-1 border border-purple-200 hover:border-purple-400 rounded-md disabled:opacity-50"
                          >
                            {convertingId === est.id ? 'Converting…' : 'Convert'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(est.id)}
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
                  <th className="text-left px-6 py-3">Estimate #</th>
                  <th className="text-left px-6 py-3">Title</th>
                  <th className="text-left px-6 py-3">Client</th>
                  <th className="text-center px-6 py-3">Status</th>
                  <th className="text-left px-6 py-3">Valid Until</th>
                  <th className="text-right px-6 py-3">Total</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)
                  : paginated.map((est) => (
                      <tr
                        key={est.id}
                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition cursor-pointer"
                        onClick={() => router.push(`/estimates/${est.id}`)}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {est.estimate_number}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{est.title || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{est.client_name || '—'}</td>
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[est.status]}`}
                          >
                            {STATUS_LABELS[est.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDateShort(est.valid_until)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(est.total, est.currency)}
                        </td>
                        <td
                          className="px-6 py-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-3">
                            {(est.status === 'draft' || est.status === 'sent') && (
                              <button
                                onClick={() => handleSend(est)}
                                disabled={sendingId === est.id}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 hover:border-blue-400 px-2 py-1 rounded-md transition disabled:opacity-50"
                              >
                                {sendingId === est.id ? 'Sending…' : 'Send to Client'}
                              </button>
                            )}
                            {est.status === 'approved' && (
                              <button
                                onClick={() => handleConvert(est)}
                                disabled={convertingId === est.id}
                                className="text-xs text-purple-600 hover:text-purple-800 font-medium border border-purple-200 hover:border-purple-400 px-2 py-1 rounded-md transition disabled:opacity-50"
                              >
                                {convertingId === est.id ? 'Converting…' : 'Convert to Invoice'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(est.id)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg z-50 ${
            toast.color === 'green' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </>
  )
}
