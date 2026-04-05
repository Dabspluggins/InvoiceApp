'use client'

import { InvoiceData } from '@/lib/types'
import { calcTotals, formatCurrency } from '@/lib/utils'

interface Props {
  data: InvoiceData
}

export default function InvoicePreview({ data }: Props) {
  const { subtotal, taxAmount, total } = calcTotals(data.lineItems, data.taxRate)

  return (
    <div
      id="invoice-preview"
      className="bg-white text-gray-800 p-10 shadow-sm"
      style={{ fontFamily: 'Georgia, serif', minHeight: '297mm', width: '100%' }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-10">
        {/* Left: logo + business */}
        <div className="flex flex-col gap-2">
          {data.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="Logo" className="h-16 w-auto object-contain mb-2" />
          )}
          <div className="text-base font-bold text-gray-900">{data.businessName || 'Your Business'}</div>
          {data.businessAddress && <div className="text-xs text-gray-500 whitespace-pre-line">{data.businessAddress}</div>}
          {data.businessEmail && <div className="text-xs text-gray-500">{data.businessEmail}</div>}
          {data.businessPhone && <div className="text-xs text-gray-500">{data.businessPhone}</div>}
        </div>

        {/* Right: INVOICE + meta */}
        <div className="text-right">
          <div className="text-4xl font-extrabold text-indigo-600 tracking-tight mb-4">INVOICE</div>
          <div className="text-xs text-gray-500 space-y-1">
            <div>
              <span className="font-semibold text-gray-700">Invoice #: </span>
              {data.invoiceNumber}
            </div>
            <div>
              <span className="font-semibold text-gray-700">Issue Date: </span>
              {data.issueDate}
            </div>
            {data.dueDate && (
              <div>
                <span className="font-semibold text-gray-700">Due Date: </span>
                {data.dueDate}
              </div>
            )}
            <div className="mt-2">
              <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded capitalize">
                {data.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div className="mb-8 bg-gray-50 rounded-lg p-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bill To</div>
        <div className="font-semibold text-gray-800">{data.clientName || 'Client Name'}</div>
        {data.clientCompany && <div className="text-sm text-gray-600">{data.clientCompany}</div>}
        {data.clientAddress && <div className="text-xs text-gray-500 whitespace-pre-line mt-1">{data.clientAddress}</div>}
        {data.clientEmail && <div className="text-xs text-gray-500 mt-1">{data.clientEmail}</div>}
      </div>

      {/* Line Items Table */}
      <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className="text-left px-3 py-2 text-xs font-semibold">Description</th>
            <th className="text-center px-3 py-2 text-xs font-semibold w-16">Qty</th>
            <th className="text-right px-3 py-2 text-xs font-semibold w-24">Rate</th>
            <th className="text-right px-3 py-2 text-xs font-semibold w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lineItems.map((item, i) => (
            <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-3 py-2 text-gray-700">{item.description || '—'}</td>
              <td className="px-3 py-2 text-center text-gray-600">{item.quantity}</td>
              <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(item.rate, data.currency)}</td>
              <td className="px-3 py-2 text-right font-medium text-gray-800">{formatCurrency(item.amount, data.currency)}</td>
            </tr>
          ))}
          {data.lineItems.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-gray-400 italic text-xs">No items added</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-56 text-sm">
          <div className="flex justify-between py-1 text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, data.currency)}</span>
          </div>
          <div className="flex justify-between py-1 text-gray-600">
            <span>Tax ({data.taxRate}%)</span>
            <span>{formatCurrency(taxAmount, data.currency)}</span>
          </div>
          <div className="flex justify-between py-2 border-t-2 border-gray-800 mt-1 font-bold text-gray-900 text-base">
            <span>Total</span>
            <span>{formatCurrency(total, data.currency)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="border-t border-gray-200 pt-4">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notes</div>
          <p className="text-xs text-gray-600 whitespace-pre-line">{data.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 text-center text-xs text-gray-300">
        Generated by InvoiceFree
      </div>
    </div>
  )
}
