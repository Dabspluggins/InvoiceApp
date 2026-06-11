'use client'

import { useRef, useEffect, useState } from 'react'
import { InvoiceData, Currency, RecurringFrequency } from '@/lib/types'
import { calcTotals } from '@/lib/utils'
import LineItemsTable from './LineItemsTable'
import Totals from './Totals'
import { createClient } from '@/lib/supabase/client'

interface Props {
  data: InvoiceData
  onChange: (data: InvoiceData) => void
}

interface SavedClient {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
}

const CURRENCIES: Currency[] = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD']

export default function InvoiceForm({ data, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [savedClients, setSavedClients] = useState<SavedClient[]>([])
  const [savingClient, setSavingClient] = useState(false)
  const [clientSaveMsg, setClientSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('clients')
        .select('id, name, company, email, phone, address')
        .order('name')
        .then(({ data }) => {
          if (data) setSavedClients(data)
        })
    })
  }, [])

  function set<K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) {
    onChange({ ...data, [key]: value })
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (error) {
      console.error('Logo upload failed:', error.message)
      return
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
    set('logoUrl', urlData.publicUrl)
  }

  function handleSelectClient(id: string) {
    if (!id) return
    const client = savedClients.find((c) => c.id === id)
    if (!client) return
    onChange({
      ...data,
      clientName: client.name,
      clientCompany: client.company || '',
      clientEmail: client.email || '',
      clientAddress: client.address || '',
    })
  }

  async function handleSaveAsClient() {
    if (!data.clientName.trim()) {
      setClientSaveMsg('Client name is required to save.')
      setTimeout(() => setClientSaveMsg(null), 3000)
      return
    }
    setSavingClient(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.clientName,
          company: data.clientCompany || null,
          email: data.clientEmail || null,
          address: data.clientAddress || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save')
      setSavedClients((prev) => [...prev, json].sort((a, b) => a.name.localeCompare(b.name)))
      setClientSaveMsg('Client saved!')
    } catch {
      setClientSaveMsg('Failed to save client.')
    } finally {
      setSavingClient(false)
      setTimeout(() => setClientSaveMsg(null), 3000)
    }
  }

  const { subtotal, taxAmount, total } = calcTotals(data.lineItems, data.taxRate)

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'
  const sectionCls = 'mb-6'
  const sectionHeadCls = 'text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100'

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Logo Upload */}
      <div className={sectionCls}>
        <p className={sectionHeadCls}>Logo</p>
        {data.logoUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.logoUrl} alt="Logo" className="h-16 w-auto object-contain rounded border border-gray-200 p-1" />
            <button
              onClick={() => set('logoUrl', null)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg px-6 py-4 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition w-full text-center"
          >
            Click to upload logo
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
      </div>

      {/* Business Info */}
      <div className={sectionCls}>
        <p className={sectionHeadCls}>Business Info</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Business Name</label>
            <input className={inputCls} value={data.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="Acme Corp" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Address</label>
            <textarea className={inputCls + ' resize-none'} rows={2} value={data.businessAddress} onChange={(e) => set('businessAddress', e.target.value)} placeholder="123 Main St, City, State 00000" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} type="email" value={data.businessEmail} onChange={(e) => set('businessEmail', e.target.value)} placeholder="hello@acme.com" />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={data.businessPhone} onChange={(e) => set('businessPhone', e.target.value)} placeholder="+1 555 000 0000" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Brand Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={data.brandColor}
                onChange={(e) => set('brandColor', e.target.value)}
                className="h-9 w-14 cursor-pointer rounded border border-gray-200 p-0.5"
              />
              <div
                className="h-9 w-9 rounded-lg border border-gray-200 shadow-sm flex-shrink-0"
                style={{ backgroundColor: data.brandColor }}
              />
              <input
                type="text"
                value={data.brandColor}
                onChange={(e) => {
                  const val = e.target.value
                  set('brandColor', val)
                  // Only update color picker if it's a valid full hex
                  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    set('brandColor', val)
                  }
                }}
                className="w-28 px-2 py-1 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="#4F46E5"
                maxLength={7}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Meta */}
      <div className={sectionCls}>
        <p className={sectionHeadCls}>Invoice Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Invoice Number</label>
            <input className={inputCls} value={data.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select className={inputCls} value={data.currency} onChange={(e) => set('currency', e.target.value as Currency)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="min-w-0">
            <label className={labelCls}>Issue Date</label>
            <input className={inputCls} type="date" value={data.issueDate} onChange={(e) => set('issueDate', e.target.value)} />
          </div>
          <div className="min-w-0">
            <label className={labelCls}>Due Date</label>
            <input className={inputCls} type="date" value={data.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
          <div className="col-span-full">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={data.isRecurring}
                onChange={(e) => {
                  set('isRecurring', e.target.checked)
                  if (!e.target.checked) set('recurringFrequency', null)
                }}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
              />
              <span className="text-xs font-medium text-gray-700">Make Recurring</span>
            </label>
          </div>
          {data.isRecurring && (
            <div className="col-span-full">
              <label className={labelCls}>Frequency</label>
              <select
                className={inputCls}
                value={data.recurringFrequency || ''}
                onChange={(e) => set('recurringFrequency', e.target.value as RecurringFrequency)}
              >
                <option value="" disabled>Select frequency…</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Client Info */}
      <div className={sectionCls}>
        <p className={sectionHeadCls}>Bill To</p>

        {/* Saved Clients dropdown */}
        {savedClients.length > 0 && (
          <div className="mb-3">
            <label className={labelCls}>Saved Clients</label>
            <select
              className={inputCls}
              defaultValue=""
              onChange={(e) => handleSelectClient(e.target.value)}
            >
              <option value="">— Select a saved client —</option>
              {savedClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` (${c.company})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Client Name</label>
            <input className={inputCls} value={data.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="Jane Smith" />
          </div>
          <div>
            <label className={labelCls}>Company</label>
            <input className={inputCls} value={data.clientCompany} onChange={(e) => set('clientCompany', e.target.value)} placeholder="Client Co." />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Address</label>
            <textarea className={inputCls + ' resize-none'} rows={2} value={data.clientAddress} onChange={(e) => set('clientAddress', e.target.value)} placeholder="456 Client Ave, City, State" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Email</label>
            <input className={inputCls} type="email" value={data.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} placeholder="client@example.com" />
          </div>
        </div>

        {/* Save as Client */}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveAsClient}
            disabled={savingClient}
            className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-lg disabled:opacity-50 transition"
          >
            {savingClient ? 'Saving...' : '+ Save as Client'}
          </button>
          {clientSaveMsg && (
            <span className={`text-xs ${clientSaveMsg.includes('Failed') || clientSaveMsg.includes('required') ? 'text-red-500' : 'text-green-600'}`}>
              {clientSaveMsg}
            </span>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className={sectionCls}>
        <p className={sectionHeadCls}>Services / Products</p>
        <LineItemsTable
          items={data.lineItems}
          currency={data.currency}
          onChange={(items) => set('lineItems', items)}
        />
      </div>

      {/* Totals */}
      <Totals
        subtotal={subtotal}
        taxRate={data.taxRate}
        taxAmount={taxAmount}
        total={total}
        currency={data.currency}
        onTaxRateChange={(rate) => set('taxRate', rate)}
      />

      {/* Notes */}
      <div className="mt-6">
        <p className={sectionHeadCls}>Notes</p>
        <textarea
          className={inputCls + ' resize-none'}
          rows={3}
          value={data.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Payment terms, bank details, thank you note..."
        />
      </div>
    </div>
  )
}
