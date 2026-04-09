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

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

const defaultData: InvoiceData = {
  invoiceNumber: 'INV-0001',
  status: 'draft',
  issueDate: todayStr(),
  dueDate: '',
  currency: 'USD',
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
}

function InvoicePageInner() {
  const [data, setData] = useState<InvoiceData>(defaultData)
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [sendModal, setSendModal] = useState<SendModalState>({
    open: false,
    toEmail: '',
    toName: '',
    subject: '',
    message: '',
    sending: false,
  })
  const searchParams = useSearchParams()
  const router = useRouter()
  const invoiceId = searchParams.get('id')

  // Load invoice from Supabase if ?id= present, else set invoice number from localStorage
  useEffect(() => {
    if (!invoiceId) {
      const stored = localStorage.getItem('invoice_counter')
      const count = stored ? parseInt(stored) : 0
      setData((prev) => ({
        ...prev,
        invoiceNumber: `INV-${String(count + 1).padStart(4, '0')}`,
      }))
      return
    }

    setSavedInvoiceId(invoiceId)

    const loadInvoice = async () => {
      const supabase = createClient()
      const { data: inv, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single()

      if (error || !inv) return

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
      })
    }

    loadInvoice()
  }, [invoiceId])

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
      message: `Hi ${data.clientName || 'there'},\n\nPlease find attached your invoice ${data.invoiceNumber}${data.dueDate ? `, due on ${data.dueDate}` : ''}.\n\nThank you for your business!`,
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
            clientName: data.clientName,
            clientCompany: data.clientCompany,
            lineItems: data.lineItems,
            taxRate: data.taxRate,
            subtotal,
            taxAmount,
            total,
            notes: data.notes,
            brandColor: data.brandColor,
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
        const { data: inserted, error } = await supabase
          .from('invoices')
          .insert(invoicePayload)
          .select('id')
          .single()
        if (error) throw error

        currentId = inserted.id
        setSavedInvoiceId(currentId)
        window.history.replaceState(null, '', `/invoice?id=${currentId}`)

        // Increment localStorage counter after saving a new invoice
        const stored = localStorage.getItem('invoice_counter')
        const count = stored ? parseInt(stored) : 0
        localStorage.setItem('invoice_counter', String(count + 1))
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
      {sendModal.open && (
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
            onClick={() => window.print()}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            Download PDF
          </button>
          <button
            onClick={openSendModal}
            className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
          >
            Send to Client
          </button>
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 p-3 border-t border-gray-200 bg-white z-10 flex gap-2 print:hidden">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : savedInvoiceId ? 'Update' : 'Save'}
        </button>
        <button
          onClick={() => window.print()}
          className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          Download PDF
        </button>
        <button
          onClick={openSendModal}
          className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
        >
          Send
        </button>
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
