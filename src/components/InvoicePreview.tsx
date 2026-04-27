'use client'

import { InvoiceData } from '@/lib/types'
import { calcTotals, formatCurrency } from '@/lib/utils'
import InvoiceWatermark from '@/components/InvoiceWatermark'
import { getInvoiceTranslations } from '@/lib/invoice-i18n'

interface Props {
  data: InvoiceData
  watermarkEnabled?: boolean
  watermarkOpacity?: number
  watermarkLogoUrl?: string | null
}

// ─── Shared payment details renderer ──────────────────────────────────────────

function PaymentBlock({ data, accentColor }: { data: InvoiceData; accentColor: string }) {
  const t = getInvoiceTranslations(data.language)
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
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>{t.paymentDetails}</span>
      </div>
      <div className="px-4 py-3 text-xs space-y-3">
        {hasBT && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">{t.bankTransfer}</div>
            <Row label={t.accountName} value={bt?.accountName} />
            <Row label={t.bankName} value={bt?.bankName} />
            <Row label={t.accountNumber} value={bt?.accountNumber} />
            <Row label={t.sortCodeRouting} value={bt?.routingNumber} />
            <Row label={t.swiftIban} value={bt?.swiftIban} />
          </div>
        )}
        {hasMM && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">{t.mobileMoney}</div>
            <Row label={t.provider} value={mm?.provider} />
            <Row label={t.phoneAccount} value={mm?.phoneNumber} />
          </div>
        )}
        {hasOT && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">{ot?.paymentMethod || t.paymentDetails}</div>
            {ot?.details && <p className="text-gray-700 whitespace-pre-line">{ot.details}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Minimal Template ──────────────────────────────────────────────────────────

function MinimalPreview({ data, watermarkEnabled, watermarkOpacity, watermarkLogoUrl }: Props) {
  const { subtotal, discountAmount, taxAmount, total } = calcTotals(data.lineItems, data.taxRate, data.discount, data.discountType)
  const t = getInvoiceTranslations(data.language)

  return (
    <div
      id="invoice-preview"
      className="bg-white text-gray-800 shadow-sm"
      style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', minHeight: '297mm', width: '100%', position: 'relative' }}
    >
      {watermarkEnabled && watermarkLogoUrl && (
        <InvoiceWatermark logoUrl={watermarkLogoUrl} opacity={watermarkOpacity ?? 10} />
      )}
      {/* Header: business name left, INVOICE right */}
      <div className="px-10 pt-10 pb-6 flex justify-between items-start">
        <div>
          <div className="text-2xl font-bold text-gray-900 tracking-tight">{data.businessName || 'Your Business'}</div>
          {data.businessAddress && <div className="text-xs text-gray-400 whitespace-pre-line mt-1">{data.businessAddress}</div>}
          {data.businessEmail && <div className="text-xs text-gray-400 mt-0.5">{data.businessEmail}</div>}
          {data.businessPhone && <div className="text-xs text-gray-400 mt-0.5">{data.businessPhone}</div>}
          {data.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="Logo" className="mt-3 h-12 w-auto object-contain" />
          )}
        </div>
        <div className="text-right">
          <div className="text-3xl font-light text-gray-300 tracking-widest uppercase">{t.invoice}</div>
          <div className="text-sm font-semibold text-gray-700 mt-1">{data.invoiceNumber}</div>
          <div className="text-xs text-gray-400 mt-3">
            <span className="font-medium text-gray-500">{t.issued}: </span>
            {new Date(data.issueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          {data.dueDate && (
            <div className="text-xs text-gray-400 mt-0.5">
              <span className="font-medium text-gray-500">{t.due}: </span>
              {new Date(data.dueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
          <div className="mt-2">
            <span className="inline-block border border-gray-300 text-gray-500 text-xs px-2 py-0.5 rounded capitalize">{t.status[data.status] ?? data.status}</span>
          </div>
        </div>
      </div>

      {/* Thin gray divider */}
      <div className="mx-10 border-t border-gray-200" />

      {/* Bill To */}
      <div className="px-10 py-6 flex gap-16">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{t.billTo}</div>
          <div className="font-semibold text-gray-800">{data.clientName || 'Client Name'}</div>
          {data.clientCompany && <div className="text-sm text-gray-500">{data.clientCompany}</div>}
          {data.clientAddress && <div className="text-xs text-gray-400 whitespace-pre-line mt-1">{data.clientAddress}</div>}
          {data.clientEmail && <div className="text-xs text-gray-400 mt-1">{data.clientEmail}</div>}
        </div>
      </div>

      {/* Thin gray divider */}
      <div className="mx-10 border-t border-gray-200" />

      {/* Line Items Table — bottom borders only */}
      <div className="px-10 pt-6 pb-4">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th className="text-left pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{t.description}</th>
              <th className="text-center pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 w-16">{t.qty}</th>
              <th className="text-right pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 w-24">{t.rate}</th>
              <th className="text-right pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 w-28">{t.amount}</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td className="py-2.5 text-gray-700">{item.description || '—'}</td>
                <td className="py-2.5 text-center text-gray-500">{item.quantity}</td>
                <td className="py-2.5 text-right text-gray-500">{formatCurrency(item.rate, data.currency)}</td>
                <td className="py-2.5 text-right text-gray-800">{formatCurrency(item.amount, data.currency)}</td>
              </tr>
            ))}
            {data.lineItems.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-gray-300 italic text-xs">{t.noItems}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals — right-aligned, simple */}
      <div className="px-10 pb-8 flex justify-end">
        <div className="w-56 text-sm">
          <div className="flex justify-between py-1 text-gray-500">
            <span>{t.subtotal}</span>
            <span>{formatCurrency(subtotal, data.currency)}</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between py-1 text-gray-500">
              <span>{t.discount}{data.discountType === 'percent' ? ` (${data.discount}%)` : ''}</span>
              <span className="text-red-500">-{formatCurrency(discountAmount, data.currency)}</span>
            </div>
          )}
          {data.taxRate > 0 && (
            <div className="flex justify-between py-1 text-gray-500">
              <span>{t.tax} ({data.taxRate}%)</span>
              <span>{formatCurrency(taxAmount, data.currency)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 mt-1 font-bold text-gray-900 border-t border-gray-300">
            <span>{t.total}</span>
            <span>{formatCurrency(total, data.currency)}</span>
          </div>
        </div>
      </div>

      <div className="mx-10 border-t border-gray-100" />

      {/* Payment Details */}
      <div className="px-10 pt-6">
        <PaymentBlock data={data} accentColor="#6b7280" />
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="px-10 pb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{t.notes}</div>
          <p className="text-xs text-gray-500 whitespace-pre-line">{data.notes}</p>
        </div>
      )}

      <div className="mt-10 pb-8 text-center text-xs text-gray-200">{t.generatedBy}</div>
    </div>
  )
}

// ─── Classic Template (existing layout) ──────────────────────────────────────

function ClassicPreview({ data, watermarkEnabled, watermarkOpacity, watermarkLogoUrl }: Props) {
  const { subtotal, discountAmount, taxAmount, total } = calcTotals(data.lineItems, data.taxRate, data.discount, data.discountType)
  const brand = data.brandColor || '#4F46E5'
  const t = getInvoiceTranslations(data.language)

  return (
    <div
      id="invoice-preview"
      className="bg-white text-gray-800 shadow-sm"
      style={{ fontFamily: 'Georgia, serif', minHeight: '297mm', width: '100%', position: 'relative' }}
    >
      {watermarkEnabled && watermarkLogoUrl && (
        <InvoiceWatermark logoUrl={watermarkLogoUrl} opacity={watermarkOpacity ?? 10} />
      )}
      {/* Header banner */}
      <div
        className="px-10 py-8 flex justify-between items-start"
        style={{ backgroundColor: brand, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}
      >
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
        <div className="text-right">
          <div className="text-4xl font-extrabold text-white tracking-tight mb-4">{t.invoice.toUpperCase()}</div>
          <div className="text-xs text-white/80 space-y-1">
            <div>
              <span className="font-semibold text-white">{t.invoiceNumber}: </span>
              {data.invoiceNumber}
            </div>
            <div>
              <span className="font-semibold text-white">{t.issued}: </span>
              {new Date(data.issueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            {data.dueDate && (
              <div>
                <span className="font-semibold text-white">{t.due}: </span>
                {new Date(data.dueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
            <div className="mt-2">
              <span className="inline-block bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded capitalize">
                {t.status[data.status] ?? data.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-10 pt-8 pb-10">
        {/* Bill To */}
        <div className="mb-8 rounded-lg p-4" style={{ backgroundColor: `${brand}15`, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: brand }}>{t.billTo}</div>
          <div className="font-semibold text-gray-800">{data.clientName || 'Client Name'}</div>
          {data.clientCompany && <div className="text-sm text-gray-600">{data.clientCompany}</div>}
          {data.clientAddress && <div className="text-xs text-gray-500 whitespace-pre-line mt-1">{data.clientAddress}</div>}
          {data.clientEmail && <div className="text-xs text-gray-500 mt-1">{data.clientEmail}</div>}
        </div>

        {/* Line Items Table */}
        <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: brand, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}>
              <th className="text-left px-3 py-2 text-xs font-semibold text-white">{t.description}</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-white w-16">{t.qty}</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-white w-24">{t.rate}</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-white w-28">{t.amount}</th>
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
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400 italic text-xs">{t.noItems}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-56 text-sm">
            <div className="flex justify-between py-1 text-gray-600">
              <span>{t.subtotal}</span>
              <span>{formatCurrency(subtotal, data.currency)}</span>
            </div>
            {data.discount > 0 && (
              <div className="flex justify-between py-1 text-gray-600">
                <span>{t.discount}{data.discountType === 'percent' ? ` (${data.discount}%)` : ''}</span>
                <span className="text-red-500">-{formatCurrency(discountAmount, data.currency)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 text-gray-600">
              <span>{t.tax} ({data.taxRate}%)</span>
              <span>{formatCurrency(taxAmount, data.currency)}</span>
            </div>
            <div
              className="flex justify-between px-3 py-2 mt-1 font-bold text-white text-base rounded"
              style={{ backgroundColor: brand, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}
            >
              <span>{t.total}</span>
              <span>{formatCurrency(total, data.currency)}</span>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <PaymentBlock data={data} accentColor={brand} />

        {/* Notes */}
        {data.notes && (
          <div className="border-t border-gray-200 pt-4">
            <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: brand }}>{t.notes}</div>
            <p className="text-xs text-gray-600 whitespace-pre-line">{data.notes}</p>
          </div>
        )}

        <div className="mt-12 text-center text-xs text-gray-300">{t.generatedBy}</div>
      </div>
    </div>
  )
}

// ─── Bold Template ────────────────────────────────────────────────────────────

function BoldPreview({ data, watermarkEnabled, watermarkOpacity, watermarkLogoUrl }: Props) {
  const { subtotal, discountAmount, taxAmount, total } = calcTotals(data.lineItems, data.taxRate, data.discount, data.discountType)
  const brand = data.brandColor || '#4F46E5'
  const t = getInvoiceTranslations(data.language)

  return (
    <div
      id="invoice-preview"
      className="bg-white text-gray-800 shadow-sm"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '297mm', width: '100%', position: 'relative' }}
    >
      {watermarkEnabled && watermarkLogoUrl && (
        <InvoiceWatermark logoUrl={watermarkLogoUrl} opacity={watermarkOpacity ?? 10} />
      )}
      {/* Full-width colored header */}
      <div
        className="px-10 py-10"
        style={{ backgroundColor: brand, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}
      >
        <div className="flex justify-between items-start">
          <div>
            {data.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logoUrl} alt="Logo" className="h-14 w-auto object-contain mb-3 bg-white/15 rounded p-1" />
            )}
            <div className="text-3xl font-black text-white tracking-tight leading-none">{data.businessName || 'Your Business'}</div>
            {data.businessAddress && <div className="text-sm text-white/70 whitespace-pre-line mt-1.5">{data.businessAddress}</div>}
            {data.businessEmail && <div className="text-sm text-white/70 mt-0.5">{data.businessEmail}</div>}
            {data.businessPhone && <div className="text-sm text-white/70 mt-0.5">{data.businessPhone}</div>}
          </div>
          <div className="text-right">
            <div className="text-5xl font-black text-white/20 uppercase tracking-widest leading-none">{t.invoice.substring(0, 3).toUpperCase()}</div>
            <div className="text-xl font-bold text-white mt-1">{data.invoiceNumber}</div>
            <div className="mt-3 space-y-1 text-sm text-white/75">
              <div>
                <span className="font-semibold text-white/90">{t.issued}: </span>
                {new Date(data.issueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {data.dueDate && (
                <div>
                  <span className="font-semibold text-white/90">{t.due}: </span>
                  {new Date(data.dueDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
            <div className="mt-3">
              <span className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">{t.status[data.status] ?? data.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bill To — white card below header */}
      <div className="px-10 py-6 border-b border-gray-100">
        <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: brand }}>{t.billTo}</div>
        <div className="text-lg font-bold text-gray-900">{data.clientName || 'Client Name'}</div>
        {data.clientCompany && <div className="text-sm font-semibold text-gray-500">{data.clientCompany}</div>}
        {data.clientAddress && <div className="text-sm text-gray-400 whitespace-pre-line mt-0.5">{data.clientAddress}</div>}
        {data.clientEmail && <div className="text-sm text-gray-400 mt-0.5">{data.clientEmail}</div>}
      </div>

      {/* Line Items Table — colored header, plain gray alternating rows */}
      <div className="px-10 py-6">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: brand, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}>
              <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-white">{t.description}</th>
              <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wider text-white w-16">{t.qty}</th>
              <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wider text-white w-24">{t.rate}</th>
              <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wider text-white w-28">{t.amount}</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item, i) => (
              <tr
                key={item.id}
                style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f3f4f6', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}
              >
                <td className="px-4 py-3 text-gray-700">{item.description || '—'}</td>
                <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.rate, data.currency)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.amount, data.currency)}</td>
              </tr>
            ))}
            {data.lineItems.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-gray-400 italic text-xs">{t.noItems}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals — colored accent bar */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1.5 text-gray-500 border-b border-gray-100">
              <span>{t.subtotal}</span>
              <span>{formatCurrency(subtotal, data.currency)}</span>
            </div>
            {data.discount > 0 && (
              <div className="flex justify-between py-1.5 text-gray-500 border-b border-gray-100">
                <span>{t.discount}{data.discountType === 'percent' ? ` (${data.discount}%)` : ''}</span>
                <span className="text-red-500">-{formatCurrency(discountAmount, data.currency)}</span>
              </div>
            )}
            {data.taxRate > 0 && (
              <div className="flex justify-between py-1.5 text-gray-500 border-b border-gray-100">
                <span>{t.tax} ({data.taxRate}%)</span>
                <span>{formatCurrency(taxAmount, data.currency)}</span>
              </div>
            )}
            <div
              className="flex justify-between items-center mt-2 rounded overflow-hidden"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}
            >
              <div className="w-1.5 self-stretch rounded-l" style={{ backgroundColor: brand }} />
              <div className="flex justify-between flex-1 px-3 py-2.5 bg-gray-900">
                <span className="font-black text-white text-sm uppercase tracking-wide">{t.totalDue}</span>
                <span className="font-black text-white text-sm">{formatCurrency(total, data.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Details */}
      <div className="px-10">
        <PaymentBlock data={data} accentColor={brand} />
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="px-10 pb-6">
          <div
            className="rounded-lg p-4"
            style={{ borderLeft: `4px solid ${brand}`, background: '#f9fafb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', colorAdjust: 'exact' }}
          >
            <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: brand }}>{t.notes}</div>
            <p className="text-sm text-gray-600 whitespace-pre-line">{data.notes}</p>
          </div>
        </div>
      )}

      <div className="mt-10 pb-8 text-center text-xs text-gray-300">{t.generatedBy}</div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function InvoicePreview({ data, watermarkEnabled, watermarkOpacity, watermarkLogoUrl }: Props) {
  const template = data.template || 'classic'
  const wProps = { watermarkEnabled, watermarkOpacity, watermarkLogoUrl }
  if (template === 'minimal') return <MinimalPreview data={data} {...wProps} />
  if (template === 'bold') return <BoldPreview data={data} {...wProps} />
  return <ClassicPreview data={data} {...wProps} />
}
