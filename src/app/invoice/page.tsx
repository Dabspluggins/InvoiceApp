'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { InvoiceData } from '@/lib/types'
import { newLineItem, calcTotals } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import InvoiceForm from '@/components/InvoiceForm'
import InvoicePreview from '@/components/InvoicePreview'

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
