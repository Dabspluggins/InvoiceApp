'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { InvoiceData } from '@/lib/types'
import { newLineItem, calcTotals } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import InvoiceForm from '@/components/InvoiceForm'
import InvoicePreview from '@/components/InvoicePreview'

interface SendModalState {
  open: boolean
  toEmail: string
  toName: string
  subject: string
  message: string
  sending: boolean
}

interface TemplateModalState {
  open: boolean
  name: string
  saving: boolean
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function nextRecurringDate(fromDate: string, frequency: string): string {
  const d = new Date(fromDate)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3)
  return d.toISOString().split('T')[0]
}

function parseNextInvoiceNumber(last: string): string {
  const match = last.match(/^(.*?)(\d+)$/)
  if (!match) return 'INV-001'
  const prefix = match[1]
  const numStr = match[2]
  const next = parseInt(numStr, 10) + 1
  return prefix + String(next).padStart(numStr.length, '0')
}

// To add the currency column to Supabase, run:
// ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN';


const defaultData: InvoiceData = {
  invoiceNumber: 'INV-0001',
  status: 'draft',
  issueDate: todayStr(),
  dueDate: '',
  currency: 'NGN',
  businessName: '',
  businessAddress: '',
  businessEmail: '',
  businessPhone: '',
  logoUrl: null,
  clientName: '',
  clientCompany: '',
  clientAddress: '',
  clientEmail: '',
  lineItems: [newLineItem()],
  taxRate: 0,
  notes: '',
  brandColor: '#4F46E5',
  isRecurring: false,
  recurringFrequency: null,
  paymentDetails: undefined,
}

function InvoicePageInner() {
  const [data, setData] = useState<InvoiceData>(defaultData)
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null)
  const [savedShareToken, setSavedShareToken] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [duplicateBanner, setDuplicateBanner] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [sendModal, setSendModal] = useState<SendModalState>({
    open: false,
    toEmail: '',
    toName: '',
    subject: '',
    message: '',
    sending: false,
  })
  const [templateModal, setTemplateModal] = useState<TemplateModalState>({
    open: false,
    name: '',
    saving: false,
  })
  const searchParams = useSearchParams()
  const router = useRouter()
  const invoiceId = searchParams.get('id')
  const templateId = searchParams.get('template')
  const duplicateId = searchParams.get('duplicate')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u))
  }, [])

  // Load invoice from Supabase if ?id= present, load template if ?template= present,
  // else auto-fill next invoice number from Supabase
  useEffect(() => {
    if (invoiceId) {
      setSavedInvoiceId(invoiceId)

      const loadInvoice = async () => {
        const supabase = createClient()
        const { data: inv, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', invoiceId)
          .single()

        if (error || !inv) return
        if (inv.share_token) setSavedShareToken(inv.share_token)

        const { data: items } = await supabase
          .from('line_items')
          .select('*')
          .eq('invoice_id', invoiceId)
          .order('sort_order')

        setData({
          invoiceNumber: inv.invoice_number,
          status: inv.status,
          issueDate: inv.issue_date,
          dueDate: inv.due_date || '',
          currency: inv.currency,
          businessName: inv.business_name || '',
          businessAddress: inv.business_address || '',
          businessEmail: inv.business_email || '',
          businessPhone: inv.business_phone || '',
          logoUrl: inv.logo_url || null,
          clientName: inv.client_name || '',
          clientCompany: inv.client_company || '',
          clientAddress: inv.client_address || '',
          clientEmail: inv.client_email || '',
          lineItems: (items || []).map((item) => ({
            id: item.id,
            description: item.description || '',
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })),
          taxRate: inv.tax_rate || 0,
          notes: inv.notes || '',
          brandColor: inv.brand_color || '#4F46E5',
          isRecurring: inv.is_recurring || false,
          recurringFrequency: inv.recurring_frequency || null,
          paymentDetails: inv.payment_details || undefined,
        })
      }

      loadInvoice()
      return
    }

    if (duplicateId) {
      const loadDuplicate = async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: inv, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', duplicateId)
          .eq('user_id', user.id)
          .single()

        if (error || !inv) return

        const { data: items } = await supabase
          .from('line_items')
          .select('*')
          .eq('invoice_id', duplicateId)
          .order('sort_order')

        const { data: latestForDup } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const nextInvoiceNumber = latestForDup?.invoice_number
          ? parseNextInvoiceNumber(latestForDup.invoice_number)
          : 'INV-001'

        setData({
          invoiceNumber: nextInvoiceNumber,
          status: 'draft',
          issueDate: todayStr(),
          dueDate: '',
          currency: inv.currency,
          businessName: inv.business_name || '',
          businessAddress: inv.business_address || '',
          businessEmail: inv.business_email || '',
          businessPhone: inv.business_phone || '',
          logoUrl: inv.logo_url || null,
          clientName: inv.client_name || '',
          clientCompany: inv.client_company || '',
          clientAddress: inv.client_address || '',
          clientEmail: inv.client_email || '',
          lineItems: (items || []).map((item) => ({
            id: crypto.randomUUID(),
            description: item.description || '',
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
          })),
          taxRate: inv.tax_rate || 0,
          notes: inv.notes || '',
          brandColor: inv.brand_color || '#4F46E5',
          isRecurring: inv.is_recurring || false,
          recurringFrequency: inv.recurring_frequency || null,
        })

        setDuplicateBanner(`Duplicated from invoice #${inv.invoice_number} — review and save as new`)
        window.history.replaceState(null, '', '/invoice')
      }

      loadDuplicate()
      return
    }

    // Auto-fill next invoice number from Supabase for new invoices
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      let nextNumber = 'INV-001'
      if (user) {
        const { data: latest } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (latest?.invoice_number) {
          nextNumber = parseNextInvoiceNumber(latest.invoice_number)
        }
      }

      if (templateId) {
        const { data: tmpl, error } = await supabase
          .from('templates')
          .select('data')
          .eq('id', templateId)
          .single()

        if (error || !tmpl) return

        const d = tmpl.data as Partial<InvoiceData>
        setData((prev) => ({
          ...prev,
          invoiceNumber: nextNumber,
          businessName: d.businessName ?? prev.businessName,
          businessAddress: d.businessAddress ?? prev.businessAddress,
          businessEmail: d.businessEmail ?? prev.businessEmail,
          businessPhone: d.businessPhone ?? prev.businessPhone,
          logoUrl: d.logoUrl ?? prev.logoUrl,
          lineItems: d.lineItems ?? prev.lineItems,
          taxRate: d.taxRate ?? prev.taxRate,
          notes: d.notes ?? prev.notes,
          brandColor: d.brandColor ?? prev.brandColor,
        }))
        return
      }

      setData((prev) => {
        if (prev.invoiceNumber !== defaultData.invoiceNumber) return prev
        return { ...prev, invoiceNumber: nextNumber }
      })
    }

    init()
  }, [invoiceId, templateId, duplicateId])

  // Auto-recalc line item amounts when qty or rate change
  useEffect(() => {
    const recalculated = data.lineItems.map((item) => ({
      ...item,
      amount: item.quantity * item.rate,
    }))
    const changed = recalculated.some((item, i) => item.amount !== data.lineItems[i].amount)
    if (changed) {
      setData((prev) => ({ ...prev, lineItems: recalculated }))
    }
  }, [data.lineItems])

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openSendModal() {
    setSendModal({
      open: true,
      toEmail: data.clientEmail || '',
      toName: data.clientName || '',
      subject: `Invoice ${data.invoiceNumber} from ${data.businessName || 'BillByDab'}`,
      message: `Hi ${data.clientName || 'there'},\n\nPlease find attached your invoice ${data.invoiceNumber}${data.dueDate ? `, due on ${new Date(data.dueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}.\n\nThank you for your business!`,
      sending: false,
    })
  }

  async function handleSend() {
    setSendModal((s) => ({ ...s, sending: true }))
    try {
      const { subtotal, taxAmount, total } = calcTotals(data.lineItems, data.taxRate)

      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: savedInvoiceId,
          shareToken: savedShareToken,
          toEmail: sendModal.toEmail,
          toName: sendModal.toName,
          subject: sendModal.subject,
          message: sendModal.message,
          invoiceData: {
            invoiceNumber: data.invoiceNumber,
            issueDate: data.issueDate,
            dueDate: data.dueDate,
            currency: data.currency,
            businessName: data.businessName,
            businessEmail: data.businessEmail,
            logoUrl: data.logoUrl,
            clientName: data.clientName,
            clientCompany: data.clientCompany,
            lineItems: data.lineItems,
            taxRate: data.taxRate,
            subtotal,
            taxAmount,
            total,
            notes: data.notes,
            brandColor: data.brandColor,
            paymentDetails: data.paymentDetails,
          },
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to send')

      // Update status to 'sent' in Supabase if invoice is saved
      if (savedInvoiceId) {
        const supabase = createClient()
        await supabase
          .from('invoices')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('id', savedInvoiceId)
        setData((prev) => ({ ...prev, status: 'sent' }))
      }

      setSendModal((s) => ({ ...s, open: false, sending: false }))
      showToast(`Invoice sent to ${sendModal.toEmail}!`, 'success')
    } catch (err) {
      console.error(err)
      setSendModal((s) => ({ ...s, sending: false }))
      showToast('Failed to send invoice. Check your Resend API key.', 'error')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { subtotal, taxAmount, total } = calcTotals(data.lineItems, data.taxRate)

      const invoicePayload = {
        user_id: user.id,
        invoice_number: data.invoiceNumber,
        status: data.status,
        issue_date: data.issueDate,
        due_date: data.dueDate || null,
        currency: data.currency,
        business_name: data.businessName,
        business_address: data.businessAddress,
        business_email: data.businessEmail,
        business_phone: data.businessPhone,
        logo_url: data.logoUrl,
        client_name: data.clientName,
        client_company: data.clientCompany,
        client_address: data.clientAddress,
        client_email: data.clientEmail,
        subtotal,
        tax_rate: data.taxRate,
        tax_amount: taxAmount,
        total,
        notes: data.notes,
        brand_color: data.brandColor,
        is_recurring: data.isRecurring,
        recurring_frequency: data.isRecurring ? data.recurringFrequency : null,
        payment_details: data.paymentDetails ?? null,
        recurring_next_date:
          data.isRecurring && data.recurringFrequency && data.dueDate
            ? nextRecurringDate(data.dueDate, data.recurringFrequency)
            : null,
      }

      let currentId = savedInvoiceId

      if (currentId) {
        const { error } = await supabase
          .from('invoices')
          .update({ ...invoicePayload, updated_at: new Date().toISOString() })
          .eq('id', currentId)
        if (error) throw error
        await supabase.from('line_items').delete().eq('invoice_id', currentId)
      } else {
        const shareToken = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
        const { data: inserted, error } = await supabase
          .from('invoices')
          .insert({ ...invoicePayload, share_token: shareToken })
          .select('id, share_token')
          .single()
        if (error) throw error

        currentId = inserted.id
        setSavedInvoiceId(currentId)
        setSavedShareToken(inserted.share_token)
        window.history.replaceState(null, '', `/invoice?id=${currentId}`)
      }

      if (data.lineItems.length > 0) {
        const lineItemsPayload = data.lineItems.map((item, idx) => ({
          invoice_id: currentId,
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          sort_order: idx,
        }))
        const { error } = await supabase.from('line_items').insert(lineItemsPayload)
        if (error) throw error
      }

      showToast('Invoice saved!', 'success')
    } catch (err) {
      console.error(err)
      showToast('Failed to save invoice.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAsTemplate() {
    if (!templateModal.name.trim()) return
    setTemplateModal((s) => ({ ...s, saving: true }))
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const templateData = {
        businessName: data.businessName,
        businessAddress: data.businessAddress,
        businessEmail: data.businessEmail,
        businessPhone: data.businessPhone,
        logoUrl: data.logoUrl,
        lineItems: data.lineItems,
        taxRate: data.taxRate,
        notes: data.notes,
        brandColor: data.brandColor,
      }

      const { error } = await supabase.from('templates').insert({
        user_id: user.id,
        name: templateModal.name.trim(),
        data: templateData,
      })

      if (error) throw error

      setTemplateModal({ open: false, name: '', saving: false })
      showToast('Template saved!', 'success')
    } catch (err) {
      console.error(err)
      setTemplateModal((s) => ({ ...s, saving: false }))
      showToast('Failed to save template.', 'error')
    }
  }

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-64px)] md:overflow-hidden relative print:block print:h-auto print:overflow-visible">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white print:hidden ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Send Invoice Modal */}
      {user && sendModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Send Invoice to Client</h2>
              <button
                onClick={() => setSendModal((s) => ({ ...s, open: false }))}
                className="text-gray-400 hover:text-gray-600 transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To (email)</label>
                <input
                  type="email"
                  value={sendModal.toEmail}
                  onChange={(e) => setSendModal((s) => ({ ...s, toEmail: e.target.value }))}
                  placeholder="client@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client name</label>
                <input
                  type="text"
                  value={sendModal.toName}
                  onChange={(e) => setSendModal((s) => ({ ...s, toName: e.target.value }))}
                  placeholder="Client name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={sendModal.subject}
                  onChange={(e) => setSendModal((s) => ({ ...s, subject: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={sendModal.message}
                  onChange={(e) => setSendModal((s) => ({ ...s, message: e.target.value }))}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSendModal((s) => ({ ...s, open: false }))}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sendModal.sending || !sendModal.toEmail}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {sendModal.sending ? 'Sending...' : 'Send Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {templateModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Save as Template</h2>
              <button
                onClick={() => setTemplateModal({ open: false, name: '', saving: false })}
                className="text-gray-400 hover:text-gray-600 transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template name</label>
              <input
                type="text"
                value={templateModal.name}
                onChange={(e) => setTemplateModal((s) => ({ ...s, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsTemplate() }}
                placeholder="e.g. Monthly Retainer"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setTemplateModal({ open: false, name: '', saving: false })}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={templateModal.saving || !templateModal.name.trim()}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {templateModal.saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile tab toggle */}
      <div className="md:hidden flex border-b border-gray-200 bg-white sticky top-0 z-10 print:hidden">
        <button
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'edit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500'
          }`}
          onClick={() => setActiveTab('edit')}
        >
          Edit
        </button>
        <button
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'preview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500'
          }`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
      </div>

      {/* Left: Form */}
      <div
        className={`md:w-[45%] md:border-r border-gray-200 bg-white md:overflow-y-auto print:hidden ${
          activeTab === 'edit' ? 'block' : 'hidden md:block'
        }`}
      >
        {duplicateBanner && (
          <div className="mx-4 mt-4 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700 flex items-center justify-between gap-3">
            <span>{duplicateBanner}</span>
            <button
              onClick={() => setDuplicateBanner(null)}
              className="text-indigo-400 hover:text-indigo-600 shrink-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
        <InvoiceForm data={data} onChange={setData} />
      </div>

      {/* Right: Preview + Actions */}
      <div
        className={`md:w-[55%] md:flex md:flex-col bg-gray-100 md:overflow-hidden print:!block print:w-full print:bg-white print:overflow-visible ${
          activeTab === 'preview' ? 'block' : 'hidden md:flex'
        }`}
      >
        <div className="flex-1 md:overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0">
          <div>
            <InvoicePreview data={data} />
          </div>
        </div>
        <div className="hidden md:flex p-4 border-t border-gray-200 bg-white gap-3 print:hidden">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : savedInvoiceId ? 'Update Invoice' : 'Save Invoice'}
          </button>
          <button
            onClick={() => setTemplateModal({ open: true, name: '', saving: false })}
            className="border border-indigo-600 text-indigo-600 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition"
          >
            Save as Template
          </button>
          <button
            onClick={() => window.print()}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            Download PDF
          </button>
          {user && (
            <button
              onClick={openSendModal}
              className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
            >
              Send to Client
            </button>
          )}
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 p-3 border-t border-gray-200 bg-white z-10 flex gap-2 print:hidden">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-indigo-600 text-white px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : savedInvoiceId ? 'Update' : 'Save'}
        </button>
        <button
          onClick={() => setTemplateModal({ open: true, name: '', saving: false })}
          className="flex-1 border border-indigo-600 text-indigo-600 px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition"
        >
          Template
        </button>
        <button
          onClick={() => window.print()}
          className="flex-1 bg-indigo-600 text-white px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
        >
          PDF
        </button>
        {user && (
          <button
            onClick={openSendModal}
            className="flex-1 bg-emerald-600 text-white px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}

export default function InvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p className="text-gray-400">Loading...</p>
        </div>
      }
    >
      <InvoicePageInner />
    </Suspense>
  )
}
