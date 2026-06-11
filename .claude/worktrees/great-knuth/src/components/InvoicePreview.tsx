'use client'

import { InvoiceData } from '@/lib/types'
import { calcTotals, formatCurrency } from '@/lib/utils'

interface Props {
  data: InvoiceData
}

export default function InvoicePreview({ data }: Props) {
  const { subtotal, taxAmount, total } = calcTotals(data.lineItems, data.taxRate)
  const brand = data.brandColor || '#4F46E5'

  return (
    <div
      id="invoice-preview"
      className="bg-white text-gray-800 shadow-sm"
      style={{ fontFamily: 'Georgia, serif', minHeight: '297mm', width: '100%' }}
    >
      {/* Header banner */}
      <div
        className="px-10 py-8 flex justify-between items-start"
        style={{ backgroundColor: brand, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}
      >
        {/* Left: logo + business */}
        <div className="flex flex-col gap-2">
          {data.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="Logo" className="h-16 w-auto object-contain mb-2 bg-white/10 rounded p-1" />
          )}
          <div className="text-base font-bold text-white">{data.businessName || 'Your Business'}</div>
          {data.businessAddress && <div className="text-xs text-white/75 whitespace-pre-line">{data.businessAddress}</div>}
          {data.businessEmail && <div className="text-xs text-white/75">{data.businessEmail}</div>}
          {data.businessPhone && <div className="text-xs text-white/75">{data.businessPhone}</div>}
        </div>

        {/* Right: INVOICE + meta */}
        <div className="text-right">
          <div className="text-4xl font-extrabold text-white tracking-tight mb-4">INVOICE</div>
          <div className="text-xs text-white/80 space-y-1">
            <div>
              <span className="font-semibold text-white">Invoice #: </span>
              {data.invoiceNumber}
            </div>
            <div>
              <span className="font-semibold text-white">Issue Date: </span>
              {new Date(data.issueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            {data.dueDate && (
              <div>
                <span className="font-semibold text-white">Due Date: </span>
                {new Date(data.dueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
            <div className="mt-2">
              <span className="inline-block bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded capitalize">
                {data.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-10 pt-8 pb-10">
        {/* Bill To */}
        <div className="mb-8 rounded-lg p-4" style={{ backgroundColor: `${brand}15`, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: brand }}>Bill To</div>
          <div className="font-semibold text-gray-800">{data.clientName || 'Client Name'}</div>
          {data.clientCompany && <div className="text-sm text-gray-600">{data.clientCompany}</div>}
          {data.clientAddress && <div className="text-xs text-gray-500 whitespace-pre-line mt-1">{data.clientAddress}</div>}
          {data.clientEmail && <div className="text-xs text-gray-500 mt-1">{data.clientEmail}</div>}
        </div>

        {/* Line Items Table */}
        <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: brand, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}>
              <th className="text-left px-3 py-2 text-xs font-semibold text-white">Description</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-white w-16">Qty</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-white w-24">Rate</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-white w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item, i) => (
              <tr key={item.id} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : `${brand}0d`, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}>
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
            <div
              className="flex justify-between px-3 py-2 mt-1 font-bold text-white text-base rounded"
              style={{ backgroundColor: brand, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}
            >
              <span>Total</span>
              <span>{formatCurrency(total, data.currency)}</span>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        {(() => {
          const pd = data.paymentDetails
          if (!pd) return null
          const bt = pd.bankTransfer
          const mm = pd.mobileMoney
          const ot = pd.other
          const hasBT = bt && Object.values(bt).some(Boolean)
          const hasMM = mm && (mm.provider || mm.phoneNumber)
          const hasOT = ot && (ot.paymentMethod || ot.details)
          if (!hasBT && !hasMM && !hasOT) return null

          const Row = ({ label, value }: { label: string; value?: string }) =>
            value ? (
              <div className="flex gap-4 py-0.5">
                <span className="w-40 flex-shrink-0 text-gray-400">{label}</span>
                <span className="text-gray-800 break-all">{value}</span>
              </div>
            ) : null

          return (
            <div className="mb-6 rounded-lg border border-gray-200 overflow-hidden" style={{ background: '#F9FAFB' }}>
              <div className="px-4 py-2.5 border-b border-gray-200">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: brand }}>Payment Details</span>
              </div>
              <div className="px-4 py-3 text-xs space-y-3">
                {hasBT && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">Bank Transfer</div>
                    <Row label="Account Name" value={bt?.accountName} />
                    <Row label="Bank Name" value={bt?.bankName} />
                    <Row label="Account Number" value={bt?.accountNumber} />
                    <Row label="Sort Code / Routing" value={bt?.routingNumber} />
                    <Row label="SWIFT / IBAN" value={bt?.swiftIban} />
                  </div>
                )}
                {hasMM && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">Mobile Money</div>
                    <Row label="Provider" value={mm?.provider} />
                    <Row label="Phone / Account" value={mm?.phoneNumber} />
                  </div>
                )}
                {hasOT && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">{ot?.paymentMethod || 'Other'}</div>
                    {ot?.details && <p className="text-gray-700 whitespace-pre-line">{ot.details}</p>}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Notes */}
        {data.notes && (
          <div className="border-t border-gray-200 pt-4">
            <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: brand }}>Notes</div>
            <p className="text-xs text-gray-600 whitespace-pre-line">{data.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-300">
          Generated by InvoiceFree
        </div>
      </div>
    </div>
  )
}
