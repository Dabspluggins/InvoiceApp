'use client'

import { useState, useEffect } from 'react'
import { InvoiceData } from '@/lib/types'
import { newLineItem } from '@/lib/utils'
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
        <div id="print-area" className="flex-1 overflow-y-auto p-6">
          <InvoicePreview data={data} />
        </div>
        <div className="p-4 border-t border-gray-200 bg-white">
          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
