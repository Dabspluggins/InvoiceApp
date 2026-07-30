'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { EstimateStatus, Currency } from '@/lib/types'

interface Estimate {
  id: string
  estimate_number: string
  title: string | null
  client_name: string | null
  client_email: string | null
  client_token: string | null
  status: EstimateStatus
  valid_until: string | null
  total: number
  currency: Currency
  created_at: string
}

const PAGE_SIZE = 20

const STATUS_COLORS: Record<EstimateStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
  client_reviewing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/60 dark:text-yellow-300',
  revised: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300',
  converted: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
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
    <tr className="border-b border-gray-50 dark:border-gray-700 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-3/4" />
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
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadEstimates()
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function loadEstimates() {
    const supabase = createClient()
    const { data } = await supabase
      .from('estimates')
      .select(
        'id, estimate_number, title, client_name, client_email, client_token, status, valid_until, total, currency, created_at'
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

  function handleWhatsApp(est: Estimate) {
    if (!est.client_token) return
    const businessName =
      user?.user_metadata?.business_name ||
      user?.email ||
      'BillByDab'
    const clientNameStr = est.client_name || 'there'
    const reviewUrl = `${window.location.origin}/estimates/${est.id}/review?token=${est.client_token}`
    const validUntilStr = est.valid_until
      ? new Date(est.valid_until + 'T00:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null
    let message = `Hi ${clientNameStr}! 👋\n\nYou have a new estimate from ${businessName}.\n\nEstimate: ${est.estimate_number}`
    if (est.title) message += `\n${est.title}`
    message += `\nTotal: ${est.currency} ${est.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (validUntilStr) message += `\nValid until: ${validUntilStr}`
    message += `\n\nReview, edit, and approve your estimate here:\n${reviewUrl}\n\nSent via BillByDab`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
    // Update status and log event client-side (fire and forget)
    const supabase = createClient()
    supabase
      .from('estimates')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', est.id)
      .then(() => {
        setEstimates((prev) =>
          prev.map((e) => (e.id === est.id ? { ...e, status: 'sent' as EstimateStatus } : e))
        )
      })
    supabase.from('estimate_events').insert({
      estimate_id: est.id,
      event_type: 'sent_whatsapp',
      actor: 'owner',
    })
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estimates</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Create and send estimates to clients for approval.
        </p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
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
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
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
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {!loading && estimates.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No estimates yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No estimates match your search or filter.
        </div>
      )}

      {(loading || paginated.length > 0) && (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden flex flex-col gap-3">
            {loading
              ? [1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                    <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/3 mb-3" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/4" />
                  </div>
                ))
              : paginated.map((est) => (
                  <div
                    key={est.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer"
                    onClick={() => router.push(`/estimates/${est.id}`)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{est.estimate_number}</p>
                        {est.title && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{est.title}</p>}
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{est.client_name || '—'}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
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
                          <span className="text-xs text-gray-400 dark:text-gray-500">
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
                        {est.client_token && (
                          <button
                            onClick={() => handleWhatsApp(est)}
                            className="inline-flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white font-medium px-2 py-1 rounded-md transition"
                            title="Send via WhatsApp"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            WA
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
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-700/50">
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
                        className="border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
                        onClick={() => router.push(`/estimates/${est.id}`)}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {est.estimate_number}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{est.title || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{est.client_name || '—'}</td>
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <span
                            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[est.status]}`}
                          >
                            {STATUS_LABELS[est.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatDateShort(est.valid_until)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white text-right">
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
                            {est.client_token && (
                              <button
                                onClick={() => handleWhatsApp(est)}
                                className="inline-flex items-center gap-1.5 text-xs bg-green-500 hover:bg-green-600 text-white font-medium px-2 py-1 rounded-md transition"
                                title="Send via WhatsApp"
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                WhatsApp
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
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
