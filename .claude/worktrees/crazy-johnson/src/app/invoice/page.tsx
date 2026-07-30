'use client'

import { useState, useEffect } from 'react'
import { InvoiceData } from '@/lib/types'
import { newLineItem } from '@/lib/utils'
import InvoiceForm from '@/components/InvoiceForm'
import InvoicePreview from '@/components/InvoicePreview'
import PdfDownloadButton from '@/components/PdfDownloadButton'

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
}

export default function InvoicePage() {
  const [data, setData] = useState<InvoiceData>(defaultData)

  // Sync invoice counter from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('invoice_counter')
    const count = stored ? parseInt(stored) : 0
    setData((prev) => ({
      ...prev,
      invoiceNumber: `INV-${String(count + 1).padStart(4, '0')}`,
    }))
  }, [])

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

  return (
    <div className="flex flex-row h-[calc(100vh-64px)] overflow-hidden">
      {/* Left: Form */}
      <div className="w-[45%] border-r border-gray-200 bg-white overflow-y-auto">
        <InvoiceForm data={data} onChange={setData} />
      </div>

      {/* Right: Preview + Download */}
      <div className="w-[55%] flex flex-col bg-gray-100 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <InvoicePreview data={data} />
        </div>
        <div className="p-4 border-t border-gray-200 bg-white">
          <PdfDownloadButton invoiceNumber={data.invoiceNumber} />
        </div>
      </div>
    </div>
  )
}
