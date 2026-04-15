'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface LineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  deleted_by_client: boolean
  sort_order: number
  min_price?: number | null
}

interface EstimateRow {
  id: string
  estimate_number: string
  title: string | null
  status: string
  valid_until: string | null
  client_name: string | null
  client_email: string | null
  client_token: string
  currency: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_type: string
  discount_value: number
  discount_amount: number
  total: number
  notes: string | null
  terms: string | null
  user_id: string
  max_discount_pct?: number | null
}

interface Props {
  estimate: EstimateRow
  lineItems: LineItem[]
  token: string
}

function calcTotals(
  items: LineItem[],
  taxRate: number,
  discountType: string,
  discountValue: number,
  proposedPrices: Record<string, string>
) {
  const activeItems = items.filter((i) => !i.deleted_by_client)
  const subtotal = activeItems.reduce((sum, i) => {
    const proposed = proposedPrices[i.id]
    const parsedProposed = proposed ? parseFloat(proposed) : NaN
    const unitPrice = !isNaN(parsedProposed) && parsedProposed > 0 ? parsedProposed : i.unit_price
    return sum + unitPrice * i.quantity
  }, 0)
  const discountAmount =
    discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue
  const taxable = Math.max(0, subtotal - discountAmount)
  const taxAmount = taxable * (taxRate / 100)
  const total = taxable + taxAmount
  return { subtotal, discountAmount, taxAmount, total }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function EstimateReviewClient({ estimate, lineItems, token }: Props) {
  const [items, setItems] = useState<(LineItem & { pendingDelete: boolean })[]>(
    lineItems.map((item) => ({ ...item, pendingDelete: false }))
  )
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionTaken, setActionTaken] = useState<'approved' | 'revised' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [proposedPrices, setProposedPrices] = useState<Record<string, string>>({})
  const [priceErrors, setPriceErrors] = useState<Record<string, string>>({})

  const activeItems = items.filter((i) => !i.pendingDelete)
  const deletedItems = items.filter((i) => i.pendingDelete)
  const hasDeletedItems = deletedItems.length > 0
  const hasProposedPrices = Object.values(proposedPrices).some((v) => v !== '' && v !== undefined)
  const canRevise = hasDeletedItems || hasProposedPrices

  const { subtotal, discountAmount, taxAmount, total } = calcTotals(
    items.map((i) => ({ ...i, deleted_by_client: i.pendingDelete })),
    estimate.tax_rate,
    estimate.discount_type,
    estimate.discount_value,
    proposedPrices
  )

  function toggleDelete(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, pendingDelete: !item.pendingDelete } : item
      )
    )
  }

  function handleProposedPriceChange(id: string, value: string) {
    setProposedPrices((prev) => ({ ...prev, [id]: value }))
    if (priceErrors[id]) {
      setPriceErrors((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  async function handleAction(action: 'approve' | 'revise') {
    setSubmitting(true)
    setError(null)
    setPriceErrors({})
    try {
      // Validate proposed prices before submitting
      const errors: Record<string, string> = {}
      const parsedProposedPrices: Record<string, number> = {}

      for (const item of items.filter((i) => !i.pendingDelete)) {
        const rawProposed = proposedPrices[item.id]
        if (!rawProposed || rawProposed.trim() === '') continue

        const proposed = parseFloat(rawProposed)
        if (isNaN(proposed) || proposed < 0) {
          errors[item.id] = 'Please enter a valid price'
          continue
        }

        const maxDiscount = estimate.max_discount_pct || 0
        const discountFloor = maxDiscount > 0 ? item.unit_price * (1 - maxDiscount / 100) : 0
        const itemFloor = item.min_price != null ? Number(item.min_price) : 0
        const effectiveFloor = Math.max(discountFloor, itemFloor)

        if (effectiveFloor > 0 && proposed < effectiveFloor) {
          errors[item.id] = `Minimum price for this item is ${formatCurrency(effectiveFloor, estimate.currency)}`
          continue
        }

        parsedProposedPrices[item.id] = proposed
      }

      if (Object.keys(errors).length > 0) {
        setPriceErrors(errors)
        setSubmitting(false)
        return
      }

      const deletedItemIds = items.filter((i) => i.pendingDelete).map((i) => i.id)
      const res = await fetch(`/api/estimates/${estimate.id}/client-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_token: token,
          action,
          deletedItemIds: action === 'revise' ? deletedItemIds : [],
          proposedPrices: action === 'revise' ? parsedProposedPrices : {},
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Something went wrong')
      setActionTaken(action === 'approve' ? 'approved' : 'revised')
      setSubmitted(true)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Already submitted — show result states
  if (estimate.status === 'approved' && !submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Already Approved</h1>
          <p className="text-gray-500 text-sm">
            You&apos;ve already approved this estimate. The business will be in touch shortly.
          </p>
        </div>
      </div>
    )
  }

  if (estimate.status === 'revised' && !submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✏️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Revisions Submitted</h1>
          <p className="text-gray-500 text-sm">
            Your revisions have already been submitted. The business will review them and be in
            touch shortly.
          </p>
        </div>
      </div>
    )
  }

  // Thank you screen after submission
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 md:p-12 max-w-lg w-full text-center">
          <div className="text-6xl mb-5">
            {actionTaken === 'approved' ? '🎉' : '✅'}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            {actionTaken === 'approved' ? 'Estimate Approved!' : 'Revisions Submitted!'}
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            Your response has been sent to{' '}
            <span className="font-semibold text-gray-800">the business</span>. They will be in
            touch shortly.
          </p>
          {actionTaken === 'approved' && (
            <p className="mt-3 text-gray-500 text-sm">
              They will now convert this estimate into an invoice and send it to you.
            </p>
          )}
          {actionTaken === 'revised' && deletedItems.length > 0 && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4 text-left">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Items you removed:
              </p>
              <ul className="space-y-1">
                {deletedItems.map((item) => (
                  <li key={item.id} className="text-sm text-gray-500 flex items-start gap-2">
                    <span className="text-red-400 shrink-0">×</span>
                    {item.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 py-6 md:py-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-indigo-200 text-xs uppercase tracking-wider mb-1">Estimate for review</p>
          <h1 className="text-2xl md:text-3xl font-bold">{estimate.estimate_number}</h1>
          {estimate.title && (
            <p className="text-indigo-100 mt-1 text-base">{estimate.title}</p>
          )}
          {estimate.valid_until && (
            <p className="text-indigo-200 text-sm mt-2">
              Valid until: {formatDate(estimate.valid_until)}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Client greeting */}
        {estimate.client_name && (
          <p className="text-gray-700 text-base">
            Hi <span className="font-semibold">{estimate.client_name}</span>, please review the
            items below. You can remove items you don&apos;t want or propose a different price.
            When done, approve or submit your revisions.
          </p>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          Click <span className="font-semibold">✕</span> to remove an item, or enter a price in
          the <span className="font-semibold">Your offer</span> field to propose a lower price.
          Undo a removal by clicking again.
        </div>

        {/* Line items card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
            {hasDeletedItems && (
              <p className="text-xs text-orange-600 mt-0.5">
                {deletedItems.length} item{deletedItems.length !== 1 ? 's' : ''} marked for
                removal
              </p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Description</th>
                  <th className="text-center px-4 py-3 w-16">Qty</th>
                  <th className="text-right px-4 py-3 w-36">Unit Price</th>
                  <th className="text-right px-4 py-3 w-28">Amount</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const rawProposed = proposedPrices[item.id] ?? ''
                  const parsedProposed = rawProposed ? parseFloat(rawProposed) : NaN
                  const effectiveUnit =
                    !isNaN(parsedProposed) && parsedProposed > 0
                      ? parsedProposed
                      : item.unit_price
                  const effectiveAmount = effectiveUnit * item.quantity

                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-gray-100 transition-colors ${
                        item.pendingDelete ? 'bg-red-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <span
                          className={`text-sm transition-all ${
                            item.pendingDelete
                              ? 'line-through text-gray-400'
                              : 'text-gray-800'
                          }`}
                        >
                          {item.description}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-4 text-center text-sm ${
                          item.pendingDelete ? 'text-gray-300' : 'text-gray-600'
                        }`}
                      >
                        {item.quantity}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div
                          className={`text-sm ${
                            item.pendingDelete ? 'text-gray-300 line-through' : 'text-gray-600'
                          }`}
                        >
                          {formatCurrency(item.unit_price, estimate.currency)}
                        </div>
                        {!item.pendingDelete && (
                          <div className="mt-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Your offer"
                              value={rawProposed}
                              onChange={(e) =>
                                handleProposedPriceChange(item.id, e.target.value)
                              }
                              className={`w-28 text-right text-xs px-2 py-1 rounded border transition-colors
                                dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500
                                ${
                                  priceErrors[item.id]
                                    ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/30 dark:border-red-500'
                                    : rawProposed
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500 dark:text-indigo-300'
                                    : 'border-gray-200 bg-white text-gray-700 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200'
                                }`}
                            />
                            {priceErrors[item.id] && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 text-right">
                                {priceErrors[item.id]}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td
                        className={`px-4 py-4 text-right text-sm font-medium ${
                          item.pendingDelete ? 'text-gray-300 line-through' : 'text-gray-800'
                        }`}
                      >
                        {formatCurrency(effectiveAmount, estimate.currency)}
                        {!item.pendingDelete && rawProposed && !isNaN(parsedProposed) && (
                          <span className="block text-xs text-indigo-500 dark:text-indigo-400">
                            proposed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => toggleDelete(item.id)}
                          className={`w-7 h-7 rounded-full text-sm font-bold transition-all flex items-center justify-center mx-auto ${
                            item.pendingDelete
                              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600'
                          }`}
                          title={item.pendingDelete ? 'Undo removal' : 'Remove this item'}
                        >
                          {item.pendingDelete ? '↩' : '×'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {items.map((item) => {
              const rawProposed = proposedPrices[item.id] ?? ''
              const parsedProposed = rawProposed ? parseFloat(rawProposed) : NaN
              const effectiveUnit =
                !isNaN(parsedProposed) && parsedProposed > 0 ? parsedProposed : item.unit_price
              const effectiveAmount = effectiveUnit * item.quantity

              return (
                <div
                  key={item.id}
                  className={`px-4 py-3 transition-colors ${
                    item.pendingDelete ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium transition-all ${
                          item.pendingDelete ? 'line-through text-gray-400' : 'text-gray-800'
                        }`}
                      >
                        {item.description}
                      </p>
                      <p
                        className={`text-xs mt-0.5 ${
                          item.pendingDelete ? 'text-gray-300' : 'text-gray-500'
                        }`}
                      >
                        {item.quantity} × {formatCurrency(item.unit_price, estimate.currency)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-semibold ${
                          item.pendingDelete ? 'line-through text-gray-300' : 'text-gray-800'
                        }`}
                      >
                        {formatCurrency(effectiveAmount, estimate.currency)}
                        {!item.pendingDelete && rawProposed && !isNaN(parsedProposed) && (
                          <span className="block text-xs font-normal text-indigo-500 dark:text-indigo-400">
                            proposed
                          </span>
                        )}
                      </p>
                      <button
                        onClick={() => toggleDelete(item.id)}
                        className={`mt-1 text-xs font-medium px-2 py-0.5 rounded-full transition-all ${
                          item.pendingDelete
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600'
                        }`}
                      >
                        {item.pendingDelete ? 'Undo' : 'Remove'}
                      </button>
                    </div>
                  </div>
                  {!item.pendingDelete && (
                    <div className="mt-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Your offer (optional)"
                        value={rawProposed}
                        onChange={(e) => handleProposedPriceChange(item.id, e.target.value)}
                        className={`w-full text-sm px-3 py-1.5 rounded border transition-colors
                          dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500
                          ${
                            priceErrors[item.id]
                              ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/30 dark:border-red-500'
                              : rawProposed
                              ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500 dark:text-indigo-300'
                              : 'border-gray-200 bg-white text-gray-700 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200'
                          }`}
                      />
                      {priceErrors[item.id] && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {priceErrors[item.id]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 px-5 py-4 space-y-2 bg-gray-50">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, estimate.currency)}</span>
            </div>
            {estimate.discount_value > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  Discount
                  {estimate.discount_type === 'percentage'
                    ? ` (${estimate.discount_value}%)`
                    : ''}
                </span>
                <span className="text-red-500">
                  −{formatCurrency(discountAmount, estimate.currency)}
                </span>
              </div>
            )}
            {estimate.tax_rate > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax ({estimate.tax_rate}%)</span>
                <span>{formatCurrency(taxAmount, estimate.currency)}</span>
              </div>
            )}
            {(hasDeletedItems || hasProposedPrices) && (
              <p className="text-xs text-orange-600 italic">
                * Total reflects your selected items and proposed prices
              </p>
            )}
            <div className="flex justify-between font-bold text-base text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{formatCurrency(total, estimate.currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {estimate.notes && (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Notes
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">{estimate.notes}</p>
          </div>
        )}

        {/* Terms */}
        {estimate.terms && (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Terms &amp; Conditions
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">{estimate.terms}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Your Response</h3>
          <p className="text-xs text-gray-500 mb-4">
            {canRevise
              ? hasDeletedItems && hasProposedPrices
                ? `You have removed ${deletedItems.length} item${deletedItems.length !== 1 ? 's' : ''} and proposed new prices. Click "Submit Revisions" to send.`
                : hasDeletedItems
                ? `You have removed ${deletedItems.length} item${deletedItems.length !== 1 ? 's' : ''}. Click "Submit Revisions" to send your changes.`
                : 'You have proposed new prices. Click "Submit Revisions" to send.'
              : 'If you\'re happy with everything, click "Approve Estimate". To remove items or propose prices, use the controls above.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleAction('approve')}
              disabled={submitting}
              className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>Submitting…</span>
              ) : (
                <>
                  <span>✓</span>
                  <span>Approve Estimate</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleAction('revise')}
              disabled={submitting || !canRevise}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              title={!canRevise ? 'Remove items or propose prices to submit revisions' : ''}
            >
              {submitting ? (
                <span>Submitting…</span>
              ) : (
                <>
                  <span>✏️</span>
                  <span>Submit Revised Estimate</span>
                </>
              )}
            </button>
          </div>
          {!canRevise && (
            <p className="text-xs text-gray-400 text-center mt-2">
              Remove items or propose prices above to enable "Submit Revised Estimate"
            </p>
          )}
        </div>

        {/* Active items summary if deletions pending */}
        {hasDeletedItems && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-orange-800 mb-2">
              Items marked for removal:
            </h3>
            <ul className="space-y-1">
              {deletedItems.map((item) => (
                <li key={item.id} className="text-sm text-orange-700 flex items-start gap-2">
                  <span className="shrink-0">×</span>
                  {item.description}
                </li>
              ))}
            </ul>
            <p className="text-xs text-orange-600 mt-2">
              These items will be removed when you submit revisions.
            </p>
          </div>
        )}

        {/* Proposed prices summary */}
        {hasProposedPrices && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 dark:bg-indigo-900/20 dark:border-indigo-700">
            <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 mb-2">
              Proposed prices:
            </h3>
            <ul className="space-y-1">
              {activeItems
                .filter((item) => proposedPrices[item.id])
                .map((item) => {
                  const raw = proposedPrices[item.id]
                  const parsed = parseFloat(raw)
                  return (
                    <li
                      key={item.id}
                      className="text-sm text-indigo-700 dark:text-indigo-300 flex items-start gap-2 justify-between"
                    >
                      <span className="truncate">{item.description}</span>
                      <span className="shrink-0 font-medium">
                        {isNaN(parsed)
                          ? raw
                          : `${formatCurrency(item.unit_price, estimate.currency)} → ${formatCurrency(parsed, estimate.currency)}`}
                      </span>
                    </li>
                  )
                })}
            </ul>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
              These prices will be sent as your offer when you submit revisions.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
