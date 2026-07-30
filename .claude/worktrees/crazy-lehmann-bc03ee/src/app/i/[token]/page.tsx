import { createClient } from '@supabase/supabase-js'
import { Metadata } from 'next'
import { Resend } from 'resend'
import PrintButton from './PrintButton'
import InvoiceWatermark from '@/components/InvoiceWatermark'
import { PaymentDetails } from '@/lib/types'

interface LineItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

interface InvoiceRow {
  id: string
  user_id: string
  invoice_number: string
  issue_date: string
  due_date: string | null
  currency: string
  business_name: string | null
  business_address: string | null
  business_email: string | null
  business_phone: string | null
  logo_url: string | null
  client_name: string | null
  client_company: string | null
  client_address: string | null
  subtotal: number
  discount: number | null
  discount_type: string | null
  discount_amount: number | null
  tax_rate: number
  tax_amount: number
  total: number
  notes: string | null
  brand_color: string | null
  payment_details: PaymentDetails | null
  view_count: number | null
  viewed_at: string | null
  template: string | null
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getInvoice(token: string) {
  const supabase = getServiceClient()
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, payment_details')
    .eq('share_token', token)
    .single()
  if (!invoice) return null

  const { data: items } = await supabase
    .from('line_items')
    .select('*')
    .eq('invoice_id', invoice.id)
    .order('sort_order')

  return { invoice: invoice as InvoiceRow, lineItems: (items || []) as LineItem[] }
}

async function getOwnerWatermark(userId: string) {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('watermark_enabled, watermark_opacity, logo_url')
    .eq('id', userId)
    .maybeSingle()
  return {
    enabled: data?.watermark_enabled ?? false,
    opacity: data?.watermark_opacity ?? 10,
    logoUrl: data?.logo_url ?? null,
  }
}

async function recordView(token: string, invoice: InvoiceRow) {
  const supabase = getServiceClient()
  const isFirstView = (invoice.view_count || 0) === 0

  await supabase
    .from('invoices')
    .update({
      viewed_at: new Date().toISOString(),
      view_count: (invoice.view_count || 0) + 1,
    })
    .eq('share_token', token)

  if (isFirstView && invoice.business_email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'BillByDab <invoices@billbydab.com>',
        to: [invoice.business_email],
        subject: `Your invoice ${invoice.invoice_number} was viewed by ${invoice.client_name || 'your client'}`,
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Invoice Viewed</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#4F46E5;padding:28px 36px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">BillByDab</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 16px;color:#111827;font-size:16px;font-weight:600;">Invoice viewed 👁</p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
              <strong>${invoice.client_name || 'Your client'}</strong> just opened invoice <strong>${invoice.invoice_number}</strong>.
              Log in to check the status.
            </p>
            <a href="https://www.billbydab.com/dashboard" style="display:inline-block;background:#4F46E5;color:#ffffff;padding:11px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Go to Dashboard →</a>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Sent via <strong style="color:#6b7280;">BillByDab</strong></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      })
    } catch (e) {
      console.error('Failed to send view notification email:', e)
    }
  }
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const result = await getInvoice(token)
  if (!result) return { title: 'Invoice not found — BillByDab' }
  const { invoice } = result
  return {
    title: `Invoice ${invoice.invoice_number}${invoice.business_name ? ` from ${invoice.business_name}` : ''} — BillByDab`,
  }
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await getInvoice(token)
  const brandColor = result?.invoice.brand_color || '#4F46E5'
  const template = result?.invoice.template || 'classic'

  if (result) {
    await recordView(token, result.invoice)
  }

  const watermark = result
    ? await getOwnerWatermark(result.invoice.user_id)
    : { enabled: false, opacity: 10, logoUrl: null as string | null }

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">📄</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Invoice not found</h1>
          <p className="text-gray-500 mb-8">
            This invoice link may have expired or doesn&apos;t exist. Please contact the sender for a
            new link.
          </p>
          <a
            href="https://www.billbydab.com"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
          >
            Go to BillByDab
          </a>
        </div>
      </div>
    )
  }

  const { invoice, lineItems } = result

  const pd = invoice.payment_details
  const bt = pd?.bankTransfer
  const mm = pd?.mobileMoney
  const ot = pd?.other
  const hasBT = bt && Object.values(bt).some(Boolean)
  const hasMM = mm && (mm.provider || mm.phoneNumber)
  const hasOT = ot && (ot.paymentMethod || ot.details)
  const hasPayment = hasBT || hasMM || hasOT

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-card { box-shadow: none !important; }
        }
      `}</style>

      {/* Nav bar */}
      <nav className="no-print sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <a href="https://www.billbydab.com" className="flex items-center gap-2">
          <span className="text-lg font-bold" style={{ color: brandColor }}>
            BillByDab
          </span>
        </a>
        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`View this invoice here: https://www.billbydab.com/i/${token}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Share
          </a>
          <PrintButton invoiceNumber={invoice.invoice_number} clientName={invoice.client_name ?? undefined} />
        </div>
      </nav>

      <main className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
        <div className="invoice-card max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden print:shadow-none print:rounded-none" style={{ position: 'relative' }}>
          {watermark.enabled && watermark.logoUrl && (
            <InvoiceWatermark logoUrl={watermark.logoUrl} opacity={watermark.opacity} />
          )}

          {template === 'minimal' ? (
            /* ── Minimal ── */
            <>
              {/* Header: business name left, invoice right */}
              <div className="px-8 sm:px-10 pt-10 pb-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div>
                  {invoice.logo_url && (
                    <img src={invoice.logo_url} alt="Logo" className="mb-3 max-h-12 max-w-[160px] object-contain" />
                  )}
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{invoice.business_name || 'Business'}</h1>
                  {invoice.business_address && <p className="text-xs text-gray-400 mt-1 whitespace-pre-line">{invoice.business_address}</p>}
                  {invoice.business_email && <p className="text-xs text-gray-400 mt-0.5">{invoice.business_email}</p>}
                  {invoice.business_phone && <p className="text-xs text-gray-400 mt-0.5">{invoice.business_phone}</p>}
                </div>
                <div className="sm:text-right">
                  <div className="text-3xl font-light text-gray-200 uppercase tracking-widest">Invoice</div>
                  <div className="text-base font-semibold text-gray-700 mt-1">{invoice.invoice_number}</div>
                  <div className="text-xs text-gray-400 mt-2">
                    <span className="font-medium text-gray-500">Issued: </span>
                    {new Date(invoice.issue_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  {invoice.due_date && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      <span className="font-medium text-gray-500">Due: </span>
                      {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  )}
                </div>
              </div>

              <div className="mx-8 sm:mx-10 border-t border-gray-200" />

              {/* Bill To */}
              <div className="px-8 sm:px-10 py-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Bill To</p>
                <p className="font-semibold text-gray-800">{invoice.client_name || '—'}</p>
                {invoice.client_company && <p className="text-sm text-gray-500">{invoice.client_company}</p>}
                {invoice.client_address && <p className="text-sm text-gray-400 whitespace-pre-line mt-0.5">{invoice.client_address}</p>}
              </div>

              <div className="mx-8 sm:mx-10 border-t border-gray-200" />

              {/* Line items — bottom borders only */}
              <div className="px-8 sm:px-10 py-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        <th className="text-left pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Description</th>
                        <th className="text-center pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Qty</th>
                        <th className="text-right pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Rate</th>
                        <th className="text-right pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td className="py-2.5 text-gray-700">{item.description || '—'}</td>
                          <td className="py-2.5 text-center text-gray-500">{item.quantity}</td>
                          <td className="py-2.5 text-right text-gray-500">{fmt(item.rate, invoice.currency)}</td>
                          <td className="py-2.5 text-right text-gray-800">{fmt(item.amount, invoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-4 flex justify-end">
                  <div className="w-full sm:w-64 text-sm space-y-1">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span>{fmt(invoice.subtotal, invoice.currency)}</span>
                    </div>
                    {(invoice.discount ?? 0) > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Discount{invoice.discount_type === 'percent' ? ` (${invoice.discount}%)` : ''}</span>
                        <span className="text-red-500">-{fmt(invoice.discount_amount ?? 0, invoice.currency)}</span>
                      </div>
                    )}
                    {invoice.tax_rate > 0 && (
                      <div className="flex justify-between text-gray-500">
                        <span>Tax ({invoice.tax_rate}%)</span>
                        <span>{fmt(invoice.tax_amount, invoice.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-300">
                      <span>Total</span>
                      <span>{fmt(invoice.total, invoice.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              {hasPayment && <SharePaymentBlock invoice={invoice} accentColor="#6b7280" />}

              {/* Notes */}
              {invoice.notes && (
                <div className="px-8 sm:px-10 pb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-500 whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}
            </>
          ) : template === 'bold' ? (
            /* ── Bold ── */
            <>
              {/* Full-width colored header */}
              <div className="px-8 sm:px-10 py-10" style={{ backgroundColor: brandColor }}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div>
                    {invoice.logo_url && (
                      <img src={invoice.logo_url} alt="Logo" className="mb-3 max-h-14 max-w-[180px] object-contain rounded" style={{ background: 'rgba(255,255,255,0.15)', padding: '4px' }} />
                    )}
                    <h1 className="text-3xl font-black text-white tracking-tight leading-none">{invoice.business_name || 'Business'}</h1>
                    {invoice.business_address && <p className="text-sm text-white/70 mt-1.5 whitespace-pre-line">{invoice.business_address}</p>}
                    {invoice.business_email && <p className="text-sm text-white/70 mt-0.5">{invoice.business_email}</p>}
                    {invoice.business_phone && <p className="text-sm text-white/70 mt-0.5">{invoice.business_phone}</p>}
                  </div>
                  <div className="sm:text-right">
                    <div className="text-5xl font-black text-white/20 uppercase tracking-widest leading-none">INV</div>
                    <div className="text-xl font-bold text-white mt-1">{invoice.invoice_number}</div>
                    <div className="mt-3 space-y-1 text-sm text-white/75">
                      <div>
                        <span className="font-semibold text-white/90">Issued: </span>
                        {new Date(invoice.issue_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {invoice.due_date && (
                        <div>
                          <span className="font-semibold text-white/90">Due: </span>
                          {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="px-8 sm:px-10 py-6 border-b border-gray-100">
                <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: brandColor }}>Bill To</p>
                <p className="text-lg font-bold text-gray-900">{invoice.client_name || '—'}</p>
                {invoice.client_company && <p className="text-sm font-semibold text-gray-500">{invoice.client_company}</p>}
                {invoice.client_address && <p className="text-sm text-gray-400 whitespace-pre-line mt-0.5">{invoice.client_address}</p>}
              </div>

              {/* Line items — colored header, plain gray alternating rows */}
              <div className="px-8 sm:px-10 py-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: brandColor }}>
                        <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-wider text-white">Description</th>
                        <th className="text-center px-4 py-3 text-xs font-black uppercase tracking-wider text-white">Qty</th>
                        <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wider text-white">Rate</th>
                        <th className="text-right px-4 py-3 text-xs font-black uppercase tracking-wider text-white">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f3f4f6' }}>
                          <td className="px-4 py-3 text-gray-700">{item.description || '—'}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{fmt(item.rate, invoice.currency)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(item.amount, invoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals — colored accent bar */}
                <div className="mt-4 flex justify-end">
                  <div className="w-full sm:w-72 text-sm space-y-1.5">
                    <div className="flex justify-between text-gray-500 border-b border-gray-100 pb-1.5">
                      <span>Subtotal</span>
                      <span>{fmt(invoice.subtotal, invoice.currency)}</span>
                    </div>
                    {(invoice.discount ?? 0) > 0 && (
                      <div className="flex justify-between text-gray-500 border-b border-gray-100 pb-1.5">
                        <span>Discount{invoice.discount_type === 'percent' ? ` (${invoice.discount}%)` : ''}</span>
                        <span className="text-red-500">-{fmt(invoice.discount_amount ?? 0, invoice.currency)}</span>
                      </div>
                    )}
                    {invoice.tax_rate > 0 && (
                      <div className="flex justify-between text-gray-500 border-b border-gray-100 pb-1.5">
                        <span>Tax ({invoice.tax_rate}%)</span>
                        <span>{fmt(invoice.tax_amount, invoice.currency)}</span>
                      </div>
                    )}
                    <div className="flex items-center mt-2 rounded overflow-hidden">
                      <div className="w-1.5 self-stretch rounded-l" style={{ backgroundColor: brandColor }} />
                      <div className="flex justify-between flex-1 px-3 py-2.5 bg-gray-900">
                        <span className="font-black text-white text-sm uppercase tracking-wide">Total Due</span>
                        <span className="font-black text-white text-sm">{fmt(invoice.total, invoice.currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              {hasPayment && <SharePaymentBlock invoice={invoice} accentColor={brandColor} />}

              {/* Notes */}
              {invoice.notes && (
                <div className="px-8 sm:px-10 pb-6">
                  <div className="rounded-lg p-4" style={{ borderLeft: `4px solid ${brandColor}`, background: '#f9fafb' }}>
                    <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: brandColor }}>Notes</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ── Classic (default) ── */
            <>
              {/* Brand color header stripe */}
              <div className="px-8 py-8 sm:px-10" style={{ backgroundColor: brandColor }}>
                {invoice.logo_url && (
                  <img src={invoice.logo_url} alt="Logo" className="mb-4 max-h-16 max-w-[180px] object-contain rounded" style={{ background: 'rgba(255,255,255,0.15)', padding: '4px' }} />
                )}
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-1">Invoice from</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{invoice.business_name || 'Business'}</h1>
                {invoice.business_address && <p className="text-sm text-white/75 mt-1 whitespace-pre-line">{invoice.business_address}</p>}
                {invoice.business_email && <p className="text-sm text-white/75">{invoice.business_email}</p>}
                {invoice.business_phone && <p className="text-sm text-white/75">{invoice.business_phone}</p>}
              </div>

              {/* Invoice meta */}
              <div className="px-8 sm:px-10 py-6 border-b border-gray-100 flex flex-col sm:flex-row sm:justify-between gap-6">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-1">Bill To</p>
                  <p className="text-base font-semibold text-gray-900">{invoice.client_name || '—'}</p>
                  {invoice.client_company && <p className="text-sm text-gray-500">{invoice.client_company}</p>}
                  {invoice.client_address && <p className="text-sm text-gray-500 whitespace-pre-line mt-0.5">{invoice.client_address}</p>}
                </div>
                <div className="sm:text-right">
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Invoice #</p>
                    <p className="text-base font-bold text-gray-900">{invoice.invoice_number}</p>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Issue Date</p>
                    <p className="text-sm text-gray-700">{new Date(invoice.issue_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  {invoice.due_date && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Due Date</p>
                      <p className="text-sm font-semibold text-gray-900">{new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div className="px-8 sm:px-10 py-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: brandColor }}>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-white rounded-tl-lg">Description</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-white">Qty</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-white">Rate</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-white rounded-tr-lg">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-3 text-gray-700">{item.description || '—'}</td>
                          <td className="px-3 py-3 text-center text-gray-600">{item.quantity}</td>
                          <td className="px-3 py-3 text-right text-gray-600">{fmt(item.rate, invoice.currency)}</td>
                          <td className="px-3 py-3 text-right text-gray-800 font-medium">{fmt(item.amount, invoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-4 flex justify-end">
                  <div className="w-full sm:w-72 space-y-2">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span>
                      <span>{fmt(invoice.subtotal, invoice.currency)}</span>
                    </div>
                    {(invoice.discount ?? 0) > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Discount{invoice.discount_type === 'percent' ? ` (${invoice.discount}%)` : ''}</span>
                        <span className="text-red-500">-{fmt(invoice.discount_amount ?? 0, invoice.currency)}</span>
                      </div>
                    )}
                    {invoice.tax_rate > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Tax ({invoice.tax_rate}%)</span>
                        <span>{fmt(invoice.tax_amount, invoice.currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold pt-2 border-t-2" style={{ borderColor: brandColor, color: brandColor }}>
                      <span>Total Due</span>
                      <span>{fmt(invoice.total, invoice.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              {hasPayment && <SharePaymentBlock invoice={invoice} accentColor={brandColor} />}

              {/* Notes */}
              {invoice.notes && (
                <div className="px-8 sm:px-10 pb-6">
                  <div className="rounded-lg p-4" style={{ borderLeft: `3px solid ${brandColor}`, background: '#F9FAFB' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="px-8 sm:px-10 py-5 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Powered by{' '}
              <a href="https://www.billbydab.com" className="font-semibold text-gray-500 hover:text-indigo-600 transition">
                BillByDab
              </a>{' '}
              — free invoice generator at billbydab.com
            </p>
          </div>
        </div>
      </main>
    </>
  )
}

function SharePaymentBlock({ invoice, accentColor }: { invoice: InvoiceRow; accentColor: string }) {
  const pd = invoice.payment_details
  if (!pd) return null
  const bt = pd.bankTransfer
  const mm = pd.mobileMoney
  const ot = pd.other
  const hasBT = bt && Object.values(bt).some(Boolean)
  const hasMM = mm && (mm.provider || mm.phoneNumber)
  const hasOT = ot && (ot.paymentMethod || ot.details)
  if (!hasBT && !hasMM && !hasOT) return null

  return (
    <div className="px-8 sm:px-10 pb-6">
      <div className="rounded-lg border border-gray-200 overflow-hidden" style={{ background: '#F9FAFB' }}>
        <div className="px-4 py-2.5 border-b border-gray-200">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>Payment Details</p>
        </div>
        <div className="px-4 py-3 text-xs space-y-3">
          {hasBT && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Bank Transfer</p>
              <div className="space-y-0.5">
                {bt?.accountName && <PayRow label="Account Name" value={bt.accountName} />}
                {bt?.bankName && <PayRow label="Bank Name" value={bt.bankName} />}
                {bt?.accountNumber && <PayRow label="Account Number" value={bt.accountNumber} />}
                {bt?.routingNumber && <PayRow label="Sort Code / Routing" value={bt.routingNumber} />}
                {bt?.swiftIban && <PayRow label="SWIFT / IBAN" value={bt.swiftIban} />}
              </div>
            </div>
          )}
          {hasMM && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Mobile Money</p>
              <div className="space-y-0.5">
                {mm?.provider && <PayRow label="Provider" value={mm.provider} />}
                {mm?.phoneNumber && <PayRow label="Phone / Account" value={mm.phoneNumber} />}
              </div>
            </div>
          )}
          {hasOT && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">{ot?.paymentMethod || 'Other'}</p>
              {ot?.details && <p className="text-gray-700 whitespace-pre-line">{ot.details}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PayRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="w-36 flex-shrink-0 text-gray-400 sm:w-40">{label}</span>
      <span className="text-gray-800 break-all">{value}</span>
    </div>
  )
}
