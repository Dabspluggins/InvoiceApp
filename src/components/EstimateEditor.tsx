'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { CURRENCIES } from '@/lib/currencies'
import type { Currency, EstimateLineItem, EstimateStatus } from '@/lib/types'

interface SavedClient {
  id: string
  name: string
  company: string | null
  email: string | null
}

interface EstimateEvent {
  id: string
  event_type: string
  actor: string
  details: Record<string, unknown> | null
  created_at: string
}

function newItem(): EstimateLineItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, amount: 0 }
}

function calcTotals(
  items: EstimateLineItem[],
  taxRate: number,
  discountType: 'percentage' | 'fixed',
  discountValue: number
) {
  const subtotal = items.reduce((sum, i) => sum + i.amount, 0)
  const discountAmount =
    discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue
  const taxable = Math.max(0, subtotal - discountAmount)
  const taxAmount = taxable * (taxRate / 100)
  const total = taxable + taxAmount
  return { subtotal, discountAmount, taxAmount, total }
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
  client_reviewing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/60 dark:text-yellow-300',
  revised: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300',
  converted: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  client_reviewing: 'Client Reviewing',
  revised: 'Revised',
  approved: 'Approved',
  rejected: 'Rejected',
  converted: 'Converted',
}

const EVENT_LABELS: Record<string, string> = {
  sent: '📧 Estimate sent to client',
  client_viewed: '👁 Client viewed the estimate',
  item_deleted: '🗑 Client removed a line item',
  approved: '✅ Client approved the estimate',
  rejected: '❌ Client rejected the estimate',
  revised: '✏️ Client submitted revisions',
  converted: '📄 Converted to invoice',
  negotiation_accepted: '✓ Negotiation accepted — client notified',
  negotiation_rejected: '✗ Negotiation rejected — client notified',
}

export default function EstimateEditor({ estimateId }: { estimateId?: string }) {
  const router = useRouter()

  // Form state
  const [estimateNumber, setEstimateNumber] = useState('EST-001')
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState('draft')
  const [validUntil, setValidUntil] = useState('')
  const [currency, setCurrency] = useState<Currency>('NGN')
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [lineItems, setLineItems] = useState<EstimateLineItem[]>([newItem()])
  const [taxRate, setTaxRate] = useState(0)
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage')
  const [discountValue, setDiscountValue] = useState(0)
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [clientToken, setClientToken] = useState<string | null>(null)
  const [allowNegotiation, setAllowNegotiation] = useState(false)
  const [maxDiscountPct, setMaxDiscountPct] = useState(0)

  // UI state
  const [savedId, setSavedId] = useState<string | null>(estimateId || null)
  const [savedClients, setSavedClients] = useState<SavedClient[]>([])
  const [events, setEvents] = useState<EstimateEvent[]>([])
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [converting, setConverting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [sendEmail, setSendEmail] = useState('')
  const [sendName, setSendName] = useState('')
  const [acceptingNegotiation, setAcceptingNegotiation] = useState(false)
  const [rejectingNegotiation, setRejectingNegotiation] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadClients = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('clients')
      .select('id, name, company, email')
      .order('name')
    setSavedClients((data as SavedClient[]) || [])
  }, [])

  const loadEstimate = useCallback(async (id: string) => {
    const supabase = createClient()
    const { data: est } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', id)
      .single()
    if (!est) return

    const { data: items } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', id)
      .eq('deleted_by_client', false)
      .order('sort_order')

    const { data: evts } = await supabase
      .from('estimate_events')
      .select('*')
      .eq('estimate_id', id)
      .order('created_at', { ascending: false })

    setEstimateNumber(est.estimate_number)
    setTitle(est.title || '')
    setStatus(est.status)
    setValidUntil(est.valid_until || '')
    setClientToken(est.client_token || null)
    setCurrency((est.currency as Currency) || 'NGN')
    setClientId(est.client_id || null)
    setClientName(est.client_name || '')
    setClientEmail(est.client_email || '')
    setTaxRate(est.tax_rate || 0)
    setDiscountType((est.discount_type as 'percentage' | 'fixed') || 'percentage')
    setDiscountValue(est.discount_value || 0)
    setNotes(est.notes || '')
    setTerms(est.terms || '')
    setAllowNegotiation(est.allow_negotiation || false)
    setMaxDiscountPct(est.max_discount_pct || 0)
    setLineItems(
      (items || []).map((item) => ({
        id: item.id,
        description: item.description || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        deleted_by_client: item.deleted_by_client,
        sort_order: item.sort_order,
        min_price: item.min_price ?? null,
        client_proposed_price: item.client_proposed_price ?? null,
      }))
    )
    setEvents((evts as EstimateEvent[]) || [])
  }, [])

  const loadNextNumber = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { count } = await supabase
      .from('estimates')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    setEstimateNumber(`EST-${String((count || 0) + 1).padStart(3, '0')}`)
  }, [])

  useEffect(() => {
    loadClients()
    if (estimateId) {
      loadEstimate(estimateId)
    } else {
      loadNextNumber()
    }
  }, [estimateId, loadClients, loadEstimate, loadNextNumber])

  // Auto-recalc amounts
  useEffect(() => {
    const updated = lineItems.map((item) => ({
      ...item,
      amount: item.quantity * item.unit_price,
    }))
    const changed = updated.some((item, i) => item.amount !== lineItems[i].amount)
    if (changed) setLineItems(updated)
  }, [lineItems])

  function handleSelectClient(id: string) {
    if (!id) {
      setClientId(null)
      return
    }
    const client = savedClients.find((c) => c.id === id)
    if (!client) return
    setClientId(id)
    setClientName(client.name || '')
    setClientEmail(client.email || '')
  }

  function updateItem(idx: number, field: keyof EstimateLineItem, value: string | number | boolean) {
    setLineItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }

  const { subtotal, discountAmount, taxAmount, total } = calcTotals(
    lineItems,
    taxRate,
    discountType,
    discountValue
  )

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const payload = {
        user_id: user.id,
        estimate_number: estimateNumber,
        title: title || null,
        status,
        valid_until: validUntil || null,
        currency,
        client_id: clientId || null,
        client_name: clientName || null,
        client_email: clientEmail || null,
        tax_rate: taxRate,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        subtotal,
        tax_amount: taxAmount,
        total,
        notes: notes || null,
        terms: terms || null,
        allow_negotiation: allowNegotiation,
        max_discount_pct: allowNegotiation ? maxDiscountPct : 0,
      }

      let currentId = savedId

      if (currentId) {
        const { error } = await supabase
          .from('estimates')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', currentId)
        if (error) throw error
        await supabase.from('estimate_line_items').delete().eq('estimate_id', currentId)
      } else {
        const { data: inserted, error } = await supabase
          .from('estimates')
          .insert(payload)
          .select('id, client_token')
          .single()
        if (error) throw error
        currentId = inserted.id
        setSavedId(currentId)
        window.history.replaceState(null, '', `/estimates/${currentId}`)
      }

      // Re-fetch the full saved row to hydrate server-generated fields (client_token, etc.)
      const { data: saved } = await supabase
        .from('estimates')
        .select('*')
        .eq('id', currentId!)
        .single()

      if (saved) {
        setClientToken(saved.client_token || null)
        setStatus(saved.status as EstimateStatus)
        setEstimateNumber(saved.estimate_number)
      }

      if (lineItems.length > 0) {
        const itemsPayload = lineItems.map((item, idx) => ({
          estimate_id: currentId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          sort_order: idx,
          min_price: item.min_price ?? null,
        }))
        const { error } = await supabase.from('estimate_line_items').insert(itemsPayload)
        if (error) throw error
      }

      showToast('Estimate saved!', 'success')
    } catch (err) {
      console.error(err)
      showToast('Failed to save estimate.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function openSendModal() {
    if (!savedId) {
      showToast('Save the estimate first before sending.', 'error')
      return
    }
    setSendEmail(clientEmail || '')
    setSendName(clientName || '')
    setSendModalOpen(true)
  }

  async function handleSend() {
    if (!savedId) return
    setSending(true)
    try {
      const res = await fetch(`/api/estimates/${savedId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: sendEmail, toName: sendName }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to send')
      setStatus('sent')
      setSendModalOpen(false)
      showToast(`Estimate sent to ${sendEmail}!`, 'success')
      // Refresh events
      const supabase = createClient()
      const { data: evts } = await supabase
        .from('estimate_events')
        .select('*')
        .eq('estimate_id', savedId)
        .order('created_at', { ascending: false })
      setEvents((evts as EstimateEvent[]) || [])
    } catch (err) {
      console.error(err)
      showToast('Failed to send estimate. Check RESEND_API_KEY.', 'error')
    } finally {
      setSending(false)
    }
  }

  async function handleWhatsApp() {
    if (!savedId) {
      showToast('Save the estimate first before sending.', 'error')
      return
    }
    if (!clientToken) {
      showToast('No review token found. Try resaving the estimate.', 'error')
      return
    }
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const businessName =
      user?.user_metadata?.business_name ||
      user?.email ||
      'BillByDab'
    const reviewUrl = `${window.location.origin}/estimates/${savedId}/review?token=${clientToken}`
    const clientNameStr = clientName || 'there'
    const validUntilStr = validUntil
      ? new Date(validUntil + 'T00:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null
    let message = `Hi ${clientNameStr}! 👋\n\nYou have a new estimate from ${businessName}.\n\nEstimate: ${estimateNumber}`
    if (title) message += `\n${title}`
    message += `\nTotal: ${currency} ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (validUntilStr) message += `\nValid until: ${validUntilStr}`
    message += `\n\nReview, edit, and approve your estimate here:\n${reviewUrl}\n\nSent via BillByDab`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank')
    // Update status to 'sent'
    await supabase
      .from('estimates')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', savedId)
    setStatus('sent')
    // Log event
    await supabase.from('estimate_events').insert({
      estimate_id: savedId,
      event_type: 'sent_whatsapp',
      actor: 'owner',
    })
    // Refresh events
    const { data: evts } = await supabase
      .from('estimate_events')
      .select('*')
      .eq('estimate_id', savedId)
      .order('created_at', { ascending: false })
    setEvents((evts as EstimateEvent[]) || [])
  }

  async function handleConvert() {
    if (!savedId) return
    if (!confirm('Convert this approved estimate to an invoice?')) return
    setConverting(true)
    try {
      const res = await fetch(`/api/estimates/${savedId}/convert`, { method: 'POST' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to convert')
      setStatus('converted')
      showToast('Converted to invoice!', 'success')
      router.push(`/invoice?id=${result.invoiceId}`)
    } catch (err) {
      console.error(err)
      showToast('Conversion failed.', 'error')
    } finally {
      setConverting(false)
    }
  }

  async function handleAcceptNegotiation() {
    if (!savedId) return
    setAcceptingNegotiation(true)
    try {
      const res = await fetch(`/api/estimates/${savedId}/accept-negotiation`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      setStatus('approved')
      showToast('Negotiation accepted. Client has been notified.', 'success')
    } catch {
      showToast('Failed to accept negotiation', 'error')
    } finally {
      setAcceptingNegotiation(false)
    }
  }

  async function handleRejectNegotiation() {
    if (!savedId) return
    setRejectingNegotiation(true)
    try {
      const res = await fetch(`/api/estimates/${savedId}/reject-negotiation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: rejectionNote.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed')
      setStatus('sent')
      setLineItems(prev => prev.map(item => ({ ...item, client_proposed_price: null })))
      setShowRejectModal(false)
      setRejectionNote('')
      showToast('Negotiation rejected. Client has been notified.', 'success')
    } catch {
      showToast('Failed to reject negotiation', 'error')
    } finally {
      setRejectingNegotiation(false)
    }
  }

  const actionBar = (
    <div className="flex gap-3 flex-wrap">
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving…' : savedId ? 'Update Estimate' : 'Save as Draft'}
      </button>
      <button
        onClick={openSendModal}
        className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
      >
        Send to Client
      </button>
      <button
        onClick={handleWhatsApp}
        className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition"
        title="Send via WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Send via WhatsApp
      </button>
      {(status === 'approved' || status === 'revised') && savedId && (
        <button
          onClick={handleConvert}
          disabled={converting}
          className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition"
        >
          {converting ? 'Converting…' : status === 'revised' ? 'Convert at Negotiated Price' : 'Convert to Invoice'}
        </button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-64px)] md:overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Send Modal */}
      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Send Estimate to Client</h2>
              <button
                onClick={() => setSendModalOpen(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To (email)
                </label>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Client name
                </label>
                <input
                  type="text"
                  value={sendName}
                  onChange={(e) => setSendName(e.target.value)}
                  placeholder="Client name"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSendModalOpen(false)}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !sendEmail}
                className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {sending ? 'Sending…' : 'Send Estimate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Negotiation Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Reject Negotiation</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              The client will be notified that their proposed prices were not accepted. The estimate will revert to its original prices.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Note to client (optional)
              </label>
              <textarea
                value={rejectionNote}
                onChange={e => setRejectionNote(e.target.value)}
                rows={3}
                placeholder="e.g. Our prices are fixed due to material costs…"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(false); setRejectionNote('') }}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectNegotiation}
                disabled={rejectingNegotiation}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
              >
                {rejectingNegotiation ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile tab toggle */}
      <div className="md:hidden flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10">
        <button
          onClick={() => setActiveTab('edit')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'edit'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'preview'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
        >
          Summary
        </button>
      </div>

      {/* LEFT: Form */}
      <div
        className={`md:w-[45%] md:border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 md:overflow-y-auto ${
          activeTab === 'edit' ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="p-6 space-y-6">
          {/* Estimate Details */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Estimate Details
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estimate #</label>
                <input
                  type="text"
                  value={estimateNumber}
                  onChange={(e) => setEstimateNumber(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Title (optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Website Redesign Project"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Valid Until</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </section>

          {/* Client */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Client
            </h2>
            {savedClients.length > 0 && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Select saved client
                </label>
                <select
                  value={clientId || ''}
                  onChange={(e) => handleSelectClient(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">— select client —</option>
                  {savedClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` (${c.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Mr A"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Client Email
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </section>

          {/* Line Items */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Line Items
            </h2>

            {/* Desktop table */}
            <div className="hidden md:block rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-center px-3 py-2 w-16">Qty</th>
                    <th className="text-right px-3 py-2 w-28">Unit Price</th>
                    <th className="text-right px-3 py-2 w-28">Amount</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => (
                    <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          placeholder="Description"
                          className="w-full text-sm focus:outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          min={0}
                          step="any"
                          onChange={(e) =>
                            updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="w-full text-sm text-center focus:outline-none bg-transparent text-gray-900 dark:text-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.unit_price}
                          min={0}
                          step="any"
                          onChange={(e) =>
                            updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                          className="w-full text-sm text-right focus:outline-none bg-transparent text-gray-900 dark:text-white"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                        {formatCurrency(item.amount, currency)}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() =>
                            setLineItems((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition text-xl leading-none"
                          aria-label="Remove item"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {lineItems.map((item, idx) => (
                <div key={item.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-2 bg-white dark:bg-gray-700/30">
                  <div className="flex justify-between items-start">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      placeholder="Description"
                      className="flex-1 text-sm focus:outline-none bg-transparent text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 font-medium"
                    />
                    <button
                      onClick={() =>
                        setLineItems((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-gray-300 dark:text-gray-600 hover:text-red-500 ml-2 text-xl leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 dark:text-gray-500">Qty</label>
                      <input
                        type="number"
                        value={item.quantity}
                        min={0}
                        step="any"
                        onChange={(e) =>
                          updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)
                        }
                        className="w-full text-sm focus:outline-none bg-transparent text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-0.5"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 dark:text-gray-500">Unit Price</label>
                      <input
                        type="number"
                        value={item.unit_price}
                        min={0}
                        step="any"
                        onChange={(e) =>
                          updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)
                        }
                        className="w-full text-sm focus:outline-none bg-transparent text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-0.5"
                      />
                    </div>
                    <div className="text-right shrink-0">
                      <label className="text-xs text-gray-400 dark:text-gray-500">Amount</label>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {formatCurrency(item.amount, currency)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setLineItems((prev) => [...prev, newItem()])}
              className="mt-3 w-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 rounded-lg py-2 text-sm transition"
            >
              + Add Line Item
            </button>
          </section>

          {/* Price Negotiation */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Price Negotiation</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Allow the client to propose lower prices within your preferred range
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer"
                  checked={allowNegotiation}
                  onChange={e => setAllowNegotiation(e.target.checked)} />
                <div className="w-10 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4 dark:bg-gray-600" />
              </label>
            </div>

            {allowNegotiation && (
              <div className="space-y-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-48 shrink-0">
                    Maximum discount allowed
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={100} step={1}
                      value={maxDiscountPct}
                      onChange={e => setMaxDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                      className="w-20 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">% off original price</span>
                  </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
                  ⚠️ Minimum prices per line item are never shown to the client. They only see their editable price field and will hit a validation error if they go below your floor.
                </p>
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Optional: set a minimum price per line item (hidden from client)
                  </p>
                  <div className="space-y-2">
                    {lineItems.map((item, idx) => (
                      <div key={item.id || idx} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                          {item.description || `Item ${idx + 1}`}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Min price:</span>
                          <input
                            type="number" min={0} step={0.01}
                            placeholder="—"
                            value={item.min_price ?? ''}
                            onChange={e => {
                              const val = e.target.value === '' ? null : Number(e.target.value)
                              setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, min_price: val } : li))
                            }}
                            className="w-28 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Discount */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Discount
            </h2>
            <div className="flex gap-3">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </select>
              <input
                type="number"
                value={discountValue}
                min={0}
                step="any"
                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                placeholder={discountType === 'percentage' ? '0' : '0.00'}
                className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </section>

          {/* Tax */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Tax
            </h2>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 dark:text-gray-300">Tax Rate (%)</label>
              <input
                type="number"
                value={taxRate}
                min={0}
                max={100}
                step="any"
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-24 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </section>

          {/* Notes & Terms */}
          <section>
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Notes & Terms
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any additional notes for the client…"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={3}
                  placeholder="e.g. This estimate is valid for 30 days…"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
          </section>

          {/* Mobile action buttons */}
          <div className="md:hidden flex gap-2 pb-6">{actionBar}</div>
        </div>
      </div>

      {/* RIGHT: Summary + Events */}
      <div
        className={`md:w-[55%] md:flex md:flex-col bg-gray-100 dark:bg-gray-900 md:overflow-hidden ${
          activeTab === 'preview' ? 'block' : 'hidden md:flex'
        }`}
      >
        <div className="flex-1 md:overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Status + number header */}
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[status]}`}
            >
              {STATUS_LABELS[status]}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{estimateNumber}</span>
          </div>

          {/* Estimate summary card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              {title || 'Untitled Estimate'}
            </h3>
            {clientName && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-0.5">
                For: <span className="font-medium">{clientName}</span>
              </p>
            )}
            {clientEmail && <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{clientEmail}</p>}
            {validUntil && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Valid until:{' '}
                {new Date(validUntil + 'T00:00:00').toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}

            {/* Line items */}
            {lineItems.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1.5">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300 flex-1 truncate pr-4">
                      {item.description || '(no description)'}
                      {item.quantity !== 1 && (
                        <span className="text-gray-400 dark:text-gray-500 ml-1">×{item.quantity}</span>
                      )}
                    </span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium shrink-0">
                      {formatCurrency(item.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="border-t border-gray-100 dark:border-gray-700 mt-3 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              {discountValue > 0 && (
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>
                    Discount{discountType === 'percentage' ? ` (${discountValue}%)` : ''}
                  </span>
                  <span className="text-red-500">−{formatCurrency(discountAmount, currency)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>Tax ({taxRate}%)</span>
                  <span>{formatCurrency(taxAmount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 dark:text-white border-t border-gray-100 dark:border-gray-700 pt-2 mt-1">
                <span>Total</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </div>

            {notes && (
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
                <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">Notes</p>
                <p className="leading-relaxed">{notes}</p>
              </div>
            )}
            {terms && (
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                <p className="font-semibold text-gray-600 dark:text-gray-300 mb-1">Terms</p>
                <p className="leading-relaxed">{terms}</p>
              </div>
            )}
          </div>

          {/* Negotiation Review Panel */}
          {status === 'revised' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-300 dark:border-amber-600 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                💬 Client Submitted Revisions
              </h3>
              {lineItems.some(item => item.client_proposed_price != null) ? (
                <table className="w-full text-sm mb-1">
                  <thead>
                    <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="text-left pb-2">Item</th>
                      <th className="text-right pb-2">Original</th>
                      <th className="text-right pb-2">Proposed</th>
                      <th className="text-right pb-2">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.filter(item => item.client_proposed_price != null).map((item, idx) => {
                      const diff = item.unit_price - (item.client_proposed_price ?? item.unit_price)
                      const diffPct = ((diff / item.unit_price) * 100).toFixed(1)
                      return (
                        <tr key={idx} className="border-b border-gray-50 dark:border-gray-700">
                          <td className="py-2 text-gray-800 dark:text-gray-200">{item.description}</td>
                          <td className="py-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.unit_price, currency)}</td>
                          <td className="py-2 text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(item.client_proposed_price!, currency)}</td>
                          <td className="py-2 text-right text-red-500">-{diffPct}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  The client removed line items. Review and accept or reject.
                </p>
              )}
              <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={handleAcceptNegotiation}
                  disabled={acceptingNegotiation}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {acceptingNegotiation ? 'Accepting…' : '✓ Accept Negotiation'}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={rejectingNegotiation}
                  className="flex-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition"
                >
                  ✗ Reject Negotiation
                </button>
              </div>
            </div>
          )}

          {/* Event history */}
          {events.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Activity</h3>
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="w-0.5 bg-indigo-100 dark:bg-indigo-900 rounded-full self-stretch shrink-0 mt-1" />
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {EVENT_LABELS[event.event_type] || event.event_type}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {new Date(event.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(event.created_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Desktop action bar */}
        <div className="hidden md:flex p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 gap-3">
          {actionBar}
        </div>
      </div>
    </div>
  )
}
