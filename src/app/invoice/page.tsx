'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { InvoiceData, Payment } from '@/lib/types'
import { newLineItem, calcTotals } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import InvoiceForm from '@/components/InvoiceForm'
import InvoicePreview from '@/components/InvoicePreview'
import LockedFeature from '@/components/LockedFeature'

interface ImportableExpense {
  id: string
  description: string
  amount: number
  date: string
  category: string
  client_id: string | null
}

interface ImportExpensesModalState {
  open: boolean
  expenses: ImportableExpense[]
  selected: Set<string>
  loading: boolean
  importing: boolean
}

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
  discount: 0,
  discountType: 'percent',
  notes: '',
  brandColor: '#4F46E5',
  isRecurring: false,
  recurringFrequency: null,
  paymentDetails: undefined,
  template: 'classic',
  language: 'en',
}

function InvoicePageInner() {
  const [data, setData] = useState<InvoiceData>(defaultData)
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null)
  const [savedShareToken, setSavedShareToken] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [duplicateBanner, setDuplicateBanner] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: '', paid_at: todayStr(), note: '' })
  const [savingPayment, setSavingPayment] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [watermarkEnabled, setWatermarkEnabled] = useState(false)
  const [watermarkOpacity, setWatermarkOpacity] = useState(10)
  const [watermarkLogoUrl, setWatermarkLogoUrl] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [clientCreditBalance, setClientCreditBalance] = useState<number>(0)
  const [creditDismissed, setCreditDismissed] = useState(false)
  const [creditApplied, setCreditApplied] = useState<number>(0)
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
  const [importExpensesModal, setImportExpensesModal] = useState<ImportExpensesModalState>({
    open: false,
    expenses: [],
    selected: new Set(),
    loading: false,
    importing: false,
  })
  const searchParams = useSearchParams()
  const router = useRouter()
  const invoiceId = searchParams.get('id')
  const templateId = searchParams.get('template')
  const duplicateId = searchParams.get('duplicate')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(!!user)
      if (!user) return
      supabase
        .from('profiles')
        .select('watermark_enabled, watermark_opacity, logo_url')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (!profile) return
          setWatermarkEnabled(profile.watermark_enabled ?? false)
          setWatermarkOpacity(profile.watermark_opacity ?? 10)
          setWatermarkLogoUrl(profile.logo_url || null)
        })
    })
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

        const { data: pmts } = await supabase
          .from('payments')
          .select('*')
          .eq('invoice_id', invoiceId)
          .order('paid_at', { ascending: true })

        setPayments(pmts || [])

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
          discount: inv.discount || 0,
          discountType: (inv.discount_type as InvoiceData['discountType']) || 'percent',
          notes: inv.notes || '',
          brandColor: inv.brand_color || '#4F46E5',
          isRecurring: inv.is_recurring || false,
          recurringFrequency: inv.recurring_frequency || null,
          paymentDetails: inv.payment_details || undefined,
          template: (inv.template as InvoiceData['template']) || 'classic',
          language: (inv.language as InvoiceData['language']) || 'en',
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

        const nextNumRes = await fetch('/api/invoices/next-number').then((r) =>
          r.ok ? r.json() : null
        )
        const nextInvoiceNumber: string = nextNumRes?.invoiceNumber ?? 'INV-0001'

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
          discount: inv.discount || 0,
          discountType: (inv.discount_type as InvoiceData['discountType']) || 'percent',
          notes: inv.notes || '',
          brandColor: inv.brand_color || '#4F46E5',
          language: (inv.language as InvoiceData['language']) || 'en',
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

      let nextNumber = 'INV-0001'
      let defaultTaxRate = 0
      let defaultNotes = ''
      let profileBrandColor: string | null = null
      let profileLogoUrl: string | null = null

      if (user) {
        const [nextNumRes, { data: profile }] = await Promise.all([
          fetch('/api/invoices/next-number').then((r) => (r.ok ? r.json() : null)),
          supabase
            .from('profiles')
            .select('default_tax_rate, default_notes, default_terms, brand_color, logo_url')
            .eq('id', user.id)
            .maybeSingle(),
        ])
        if (nextNumRes?.invoiceNumber) {
          nextNumber = nextNumRes.invoiceNumber
        }
        if (profile?.default_tax_rate != null) {
          defaultTaxRate = Number(profile.default_tax_rate)
        }
        if (profile?.default_notes) {
          defaultNotes = profile.default_notes
        }
        if (profile) {
          profileBrandColor = profile.brand_color || null
          profileLogoUrl = profile.logo_url || null
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
          logoUrl: d.logoUrl ?? profileLogoUrl ?? prev.logoUrl,
          lineItems: d.lineItems ?? prev.lineItems,
          taxRate: d.taxRate ?? prev.taxRate,
          notes: d.notes ?? prev.notes,
          brandColor: d.brandColor ?? profileBrandColor ?? prev.brandColor,
          language: (d.language as InvoiceData['language']) ?? prev.language,
        }))
        return
      }

      setData((prev) => {
        if (prev.invoiceNumber !== defaultData.invoiceNumber) return prev
        return {
          ...prev,
          invoiceNumber: nextNumber,
          taxRate: defaultTaxRate,
          notes: defaultNotes || prev.notes,
          brandColor: profileBrandColor ?? prev.brandColor,
          logoUrl: profileLogoUrl ?? prev.logoUrl,
        }
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

  function handleDownloadPDF() {
    const invoiceNumber = data.invoiceNumber
    const clientName = data.clientName
    const parts = ['BillByDab', 'Invoice', invoiceNumber, clientName].filter(Boolean)
    const title = parts.join(' - ')
    const prev = document.title
    document.title = title
    window.print()
    setTimeout(() => { document.title = prev }, 1000)
  }

  function handleWhatsApp() {
    if (!savedShareToken) {
      showToast('Save your invoice first to share via WhatsApp', 'error')
      return
    }
    const { total } = calcTotals(data.lineItems, data.taxRate, data.discount, data.discountType)
    const shareUrl = `https://www.billbydab.com/i/${savedShareToken}`
    const businessName = data.businessName || 'Your Service Provider'
    const clientName = data.clientName || 'there'
    const dueDate = data.dueDate
      ? new Date(data.dueDate + 'T00:00:00').toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'N/A'
    const message =
      `Hi ${clientName},\n\nPlease find your invoice from ${businessName} below:\n\n` +
      `Invoice No: ${data.invoiceNumber}\nAmount Due: ${data.currency}${total.toLocaleString()}\nDue Date: ${dueDate}\n\n` +
      `View & download your invoice here:\n${shareUrl}\n\nThank you for your business.`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  async function handleClientSelect(clientId: string) {
    setSelectedClientId(clientId)
    setCreditDismissed(false)
    setCreditApplied(0)

    const supabase = createClient()
    const { data: rows } = await supabase
      .from('client_credits')
      .select('amount, type')
      .eq('client_id', clientId)

    const credited = rows?.filter((r) => r.type === 'credited').reduce((s, r) => s + Number(r.amount), 0) ?? 0
    const applied = rows?.filter((r) => r.type === 'applied').reduce((s, r) => s + Number(r.amount), 0) ?? 0
    setClientCreditBalance(credited - applied)
  }

  function handleApplyCredit() {
    const { total } = calcTotals(data.lineItems, data.taxRate, data.discount, data.discountType)
    const toApply = Math.min(clientCreditBalance, total)
    setCreditApplied(toApply)
    setCreditDismissed(true)
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
    if (!savedInvoiceId) {
      showToast('Save your invoice before sending it to a client.', 'error')
      return
    }
    setSendModal((s) => ({ ...s, sending: true }))
    try {
      const { subtotal, taxAmount, total } = calcTotals(data.lineItems, data.taxRate, data.discount, data.discountType)

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
            language: data.language || 'en',
          },
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to send')
      if (result.shareToken) setSavedShareToken(result.shareToken)

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

      const { subtotal, discountAmount, taxAmount, total } = calcTotals(data.lineItems, data.taxRate, data.discount, data.discountType)

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
        discount: data.discount,
        discount_type: data.discountType,
        discount_amount: discountAmount,
        tax_rate: data.taxRate,
        tax_amount: taxAmount,
        total,
        notes: data.notes,
        brand_color: data.brandColor,
        is_recurring: data.isRecurring,
        recurring_frequency: data.isRecurring ? data.recurringFrequency : null,
        payment_details: data.paymentDetails ?? null,
        template: data.template || 'classic',
        language: data.language || 'en',
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
        const tokenRes = await fetch('/api/invoices/share-token', { method: 'POST' })
        if (!tokenRes.ok) throw new Error('Failed to generate share token')
        const { token: shareToken } = await tokenRes.json()
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

      // Record applied credit if any
      if (creditApplied > 0 && selectedClientId && currentId) {
        await fetch('/api/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: selectedClientId,
            amount: creditApplied,
            type: 'applied',
            reference_invoice_id: currentId,
            description: `Credit applied to ${data.invoiceNumber}`,
          }),
        })
        setClientCreditBalance((prev) => prev - creditApplied)
        setCreditApplied(0)
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
        language: data.language || 'en',
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

  async function handleRecordPayment() {
    if (!savedInvoiceId) return
    const amt = parseFloat(paymentForm.amount)
    if (isNaN(amt) || amt <= 0) return
    setSavingPayment(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const res = await fetch(`/api/invoices/${savedInvoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          paid_at: paymentForm.paid_at,
          note: paymentForm.note.trim() || null,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to record payment')

      const newPayments = [...payments, result.payment]
      setPayments(newPayments)

      setData((prev) => ({ ...prev, status: result.status as typeof prev.status }))

      setPaymentForm({ amount: '', paid_at: todayStr(), note: '' })
      setShowPaymentForm(false)
      showToast('Payment recorded!', 'success')
    } catch (err) {
      console.error(err)
      showToast('Failed to record payment.', 'error')
    } finally {
      setSavingPayment(false)
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!savedInvoiceId) return
    try {
      const res = await fetch(`/api/invoices/${savedInvoiceId}/payments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to delete payment')

      const newPayments = payments.filter((p) => p.id !== paymentId)
      setPayments(newPayments)
      setData((prev) => ({ ...prev, status: result.status as typeof prev.status }))
    } catch (err) {
      console.error(err)
      showToast('Failed to delete payment.', 'error')
    }
  }

  async function openImportExpenses() {
    if (!savedInvoiceId) {
      showToast('Please save the invoice first before importing expenses.', 'error')
      return
    }
    setImportExpensesModal({ open: true, expenses: [], selected: new Set(), loading: true, importing: false })
    const supabase = createClient()

    // Try to find client_id from invoice's clientEmail
    let clientId: string | null = null
    if (data.clientEmail) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('email', data.clientEmail)
        .maybeSingle()
      if (clientData?.id) clientId = clientData.id
    }

    let query = supabase
      .from('expenses')
      .select('id, description, amount, date, category, client_id')
      .eq('billable', true)
      .eq('billed', false)
      .order('date', { ascending: false })

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data: expenses } = await query
    setImportExpensesModal((m) => ({ ...m, expenses: expenses || [], loading: false }))
  }

  function toggleImportExpense(id: string) {
    setImportExpensesModal((m) => {
      const next = new Set(m.selected)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...m, selected: next }
    })
  }

  async function handleImportExpenses() {
    const toAdd = importExpensesModal.expenses.filter((e) => importExpensesModal.selected.has(e.id))
    if (toAdd.length === 0) return

    setImportExpensesModal((m) => ({ ...m, importing: true }))

    const newLineItems = toAdd.map((exp) => ({
      id: crypto.randomUUID(),
      description: exp.description,
      quantity: 1,
      rate: exp.amount,
      amount: exp.amount,
    }))

    setData((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, ...newLineItems],
    }))

    // Mark as billed and link to this invoice
    if (savedInvoiceId) {
      const supabase = createClient()
      await supabase
        .from('expenses')
        .update({ billed: true, invoice_id: savedInvoiceId })
        .in('id', toAdd.map((e) => e.id))
    }

    setImportExpensesModal({ open: false, expenses: [], selected: new Set(), loading: false, importing: false })
    showToast(`${toAdd.length} expense${toAdd.length !== 1 ? 's' : ''} added as line items`, 'success')
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
      {isSignedIn && sendModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Send Invoice to Client</h2>
              <button
                onClick={() => setSendModal((s) => ({ ...s, open: false }))}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To (email)</label>
                <input
                  type="email"
                  value={sendModal.toEmail}
                  onChange={(e) => setSendModal((s) => ({ ...s, toEmail: e.target.value }))}
                  placeholder="client@example.com"
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client name</label>
                <input
                  type="text"
                  value={sendModal.toName}
                  onChange={(e) => setSendModal((s) => ({ ...s, toName: e.target.value }))}
                  placeholder="Client name"
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                <input
                  type="text"
                  value={sendModal.subject}
                  onChange={(e) => setSendModal((s) => ({ ...s, subject: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                <textarea
                  value={sendModal.message}
                  onChange={(e) => setSendModal((s) => ({ ...s, message: e.target.value }))}
                  rows={4}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSendModal((s) => ({ ...s, open: false }))}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Save as Template</h2>
              <button
                onClick={() => setTemplateModal({ open: false, name: '', saving: false })}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template name</label>
              <input
                type="text"
                value={templateModal.name}
                onChange={(e) => setTemplateModal((s) => ({ ...s, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsTemplate() }}
                placeholder="e.g. Monthly Retainer"
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setTemplateModal({ open: false, name: '', saving: false })}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
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

      {/* Import Expenses Modal */}
      {importExpensesModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Import Unbilled Expenses</h2>
              <button
                onClick={() => setImportExpensesModal((m) => ({ ...m, open: false }))}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {importExpensesModal.loading ? (
              <div className="flex-1 flex items-center justify-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                Loading expenses...
              </div>
            ) : importExpensesModal.expenses.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-sm">No unbilled billable expenses found{data.clientEmail ? ' for this client' : ''}.</p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Log expenses at <span className="text-indigo-600">/expenses</span> first.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {importExpensesModal.expenses.map((exp) => (
                  <label
                    key={exp.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      importExpensesModal.selected.has(exp.id)
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={importExpensesModal.selected.has(exp.id)}
                      onChange={() => toggleImportExpense(exp.id)}
                      className="accent-indigo-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{exp.description}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {new Date(exp.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{exp.category}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">
                      ₦{exp.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </label>
                ))}
              </div>
            )}

            {!importExpensesModal.loading && importExpensesModal.expenses.length > 0 && (
              <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => setImportExpensesModal((m) => ({ ...m, open: false }))}
                  className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportExpenses}
                  disabled={importExpensesModal.selected.size === 0 || importExpensesModal.importing}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {importExpensesModal.importing
                    ? 'Adding...'
                    : `Add Selected (${importExpensesModal.selected.size})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile tab toggle */}
      <div className="md:hidden flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10 print:hidden">
        <button
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'edit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
          onClick={() => setActiveTab('edit')}
        >
          Edit
        </button>
        <button
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'preview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 dark:text-gray-400'
          }`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
      </div>

      {/* Left: Form */}
      <div
        className={`md:w-[45%] md:border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 md:overflow-y-auto print:hidden ${
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
        <div className="mx-4 mt-4">
          <LockedFeature isLocked={!isSignedIn}>
            <button
              onClick={openImportExpenses}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 px-4 py-2.5 rounded-lg text-sm font-semibold transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              Import Expenses as Line Items
            </button>
          </LockedFeature>
        </div>
        {clientCreditBalance > 0 && !creditDismissed && (
          <div className="mx-4 mt-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span>
              This client has <strong>₦{clientCreditBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> in credit. Apply credit to this invoice?
            </span>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleApplyCredit}
                className="text-xs font-semibold bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition"
              >
                Apply ₦{Math.min(clientCreditBalance, calcTotals(data.lineItems, data.taxRate, data.discount, data.discountType).total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credit
              </button>
              <button
                onClick={() => setCreditDismissed(true)}
                className="text-xs font-medium text-green-700 hover:text-green-900 px-2 py-1.5"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {creditApplied > 0 && (
          <div className="mx-4 mt-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center justify-between gap-3">
            <span>Credit applied: −₦{creditApplied.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <button
              onClick={() => { setCreditApplied(0); setCreditDismissed(false) }}
              className="text-green-500 hover:text-green-700"
            >
              ✕
            </button>
          </div>
        )}
        <InvoiceForm data={data} onChange={setData} isSignedIn={isSignedIn} onClientSelect={handleClientSelect} />

        {savedInvoiceId && (() => {
          const { total } = calcTotals(data.lineItems, data.taxRate, data.discount, data.discountType)
          const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
          const outstanding = total - totalPaid
          return (
            <div className="mx-4 mb-6 mt-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Payments</h3>
                {!showPaymentForm && (
                  <button
                    onClick={() => {
                      setPaymentForm({ amount: outstanding > 0 ? outstanding.toFixed(2) : '', paid_at: todayStr(), note: '' })
                      setShowPaymentForm(true)
                    }}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700 transition"
                  >
                    + Record Payment
                  </button>
                )}
              </div>

              {payments.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                      <div>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{data.currency} {p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{new Date(p.paid_at + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {p.note && <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 italic">{p.note}</span>}
                      </div>
                      <button
                        onClick={() => handleDeletePayment(p.id)}
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition text-base leading-none ml-3"
                        title="Delete payment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between text-sm mb-3 border-t border-gray-200 dark:border-gray-600 pt-2">
                <span className="text-gray-500 dark:text-gray-400">Total Paid</span>
                <span className="font-semibold text-green-600">{data.currency} {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Outstanding</span>
                <span className={`font-bold ${outstanding > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                  {data.currency} {outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {showPaymentForm && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Date</label>
                      <input
                        type="date"
                        value={paymentForm.paid_at}
                        onChange={(e) => setPaymentForm((s) => ({ ...s, paid_at: e.target.value }))}
                        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Note (optional)</label>
                    <input
                      type="text"
                      value={paymentForm.note}
                      onChange={(e) => setPaymentForm((s) => ({ ...s, note: e.target.value }))}
                      placeholder="e.g. Bank transfer, Cash deposit"
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setShowPaymentForm(false)}
                      className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRecordPayment}
                      disabled={savingPayment || !paymentForm.amount}
                      className="flex-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                      {savingPayment ? 'Saving...' : 'Save Payment'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Right: Preview + Actions */}
      <div
        className={`md:w-[55%] md:flex md:flex-col bg-gray-100 dark:bg-gray-900 md:overflow-hidden print:!block print:w-full print:bg-white print:overflow-visible ${
          activeTab === 'preview' ? 'block' : 'hidden md:flex'
        }`}
      >
        <div className="flex-1 md:overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0">
          {/* Template picker */}
          <div className="mb-4 print:hidden">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Template</p>
            <div className="flex gap-3">
              {(['minimal', 'classic', 'bold'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setData((prev) => ({ ...prev, template: t }))}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                    (data.template || 'classic') === t
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 bg-white dark:bg-gray-800'
                  }`}
                >
                  {/* Thumbnail mock */}
                  {t === 'minimal' && (
                    <div className="w-16 h-11 bg-white border border-gray-200 rounded overflow-hidden p-1 flex flex-col gap-0.5">
                      <div className="h-1.5 w-8 bg-gray-800 rounded-sm" />
                      <div className="h-0.5 w-full bg-gray-200 mt-0.5" />
                      <div className="h-0.5 w-10 bg-gray-200" />
                      <div className="h-0.5 w-10 bg-gray-200" />
                      <div className="h-0.5 w-full bg-gray-100 mt-0.5" />
                      <div className="h-0.5 w-12 bg-gray-100" />
                      <div className="h-0.5 w-8 bg-gray-300 mt-0.5" />
                    </div>
                  )}
                  {t === 'classic' && (
                    <div className="w-16 h-11 rounded overflow-hidden flex flex-col">
                      <div className="h-3.5 w-full flex items-center px-1" style={{ backgroundColor: data.brandColor || '#4F46E5' }}>
                        <div className="h-1 w-5 bg-white/70 rounded-sm" />
                      </div>
                      <div className="flex-1 bg-white p-1 flex flex-col gap-0.5">
                        <div className="h-0.5 w-8 rounded-sm" style={{ backgroundColor: `${data.brandColor || '#4F46E5'}80` }} />
                        <div className="h-0.5 w-10 bg-gray-200" />
                        <div className="h-0.5 w-10 bg-gray-100" />
                        <div className="h-1.5 w-full rounded-sm mt-0.5" style={{ backgroundColor: `${data.brandColor || '#4F46E5'}40` }} />
                      </div>
                    </div>
                  )}
                  {t === 'bold' && (
                    <div className="w-16 h-11 rounded overflow-hidden flex flex-col">
                      <div className="h-4 w-full flex items-end px-1 pb-1" style={{ backgroundColor: data.brandColor || '#4F46E5' }}>
                        <div className="h-1.5 w-7 bg-white/90 rounded-sm font-bold" />
                      </div>
                      <div className="flex-1 bg-white p-1 flex flex-col gap-0.5">
                        <div className="h-0.5 w-10 bg-gray-200" />
                        <div className="h-0.5 w-10 bg-gray-100" />
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <div className="w-0.5 h-2 rounded-sm" style={{ backgroundColor: data.brandColor || '#4F46E5' }} />
                          <div className="h-2 flex-1 bg-gray-800 rounded-sm" />
                        </div>
                      </div>
                    </div>
                  )}
                  <span className={`text-xs font-medium capitalize ${(data.template || 'classic') === t ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'}`}>
                    {t}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <InvoicePreview
              data={data}
              watermarkEnabled={watermarkEnabled}
              watermarkOpacity={watermarkOpacity}
              watermarkLogoUrl={watermarkLogoUrl}
            />
          </div>
        </div>
        <div className="hidden md:flex p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 gap-3 print:hidden">
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
            onClick={handleDownloadPDF}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            Download PDF
          </button>
          {isSignedIn && (
            <button
              onClick={openSendModal}
              className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
            >
              Send to Client
            </button>
          )}
          {isSignedIn && (
            <button
              onClick={handleWhatsApp}
              className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition inline-flex items-center gap-2"
              title="Send via WhatsApp"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10 flex gap-2 print:hidden">
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
          onClick={handleDownloadPDF}
          className="flex-1 bg-indigo-600 text-white px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
        >
          PDF
        </button>
        {isSignedIn && (
          <button
            onClick={openSendModal}
            className="flex-1 bg-emerald-600 text-white px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
          >
            Send
          </button>
        )}
        {isSignedIn && (
          <button
            onClick={handleWhatsApp}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2.5 rounded-lg text-xs font-semibold transition inline-flex items-center justify-center gap-1"
            title="Send via WhatsApp"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WA
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
