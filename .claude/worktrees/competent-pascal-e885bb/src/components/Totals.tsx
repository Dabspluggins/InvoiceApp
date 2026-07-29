'use client'

import { Currency } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  subtotal: number
  discount: number
  discountType: 'percent' | 'fixed'
  discountAmount: number
  taxRate: number
  taxAmount: number
  total: number
  currency: Currency
  onTaxRateChange: (rate: number) => void
  onDiscountChange: (discount: number) => void
  onDiscountTypeChange: (type: 'percent' | 'fixed') => void
}

export default function Totals({ subtotal, discount, discountType, discountAmount, taxRate, taxAmount, total, currency, onTaxRateChange, onDiscountChange, onDiscountTypeChange }: Props) {
  return (
    <div className="mt-4 flex flex-col items-end gap-1.5 text-sm">
      <div className="flex items-center gap-8 w-64">
        <span className="text-gray-500 flex-1">Subtotal</span>
        <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
      </div>
      <div className="flex items-center gap-8 w-64">
        <span className="text-gray-500 flex-1 flex items-center gap-1">
          Discount
          <input
            type="number"
            value={discount}
            min={0}
            step="0.1"
            onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
            className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 ml-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="button"
            onClick={() => onDiscountTypeChange(discountType === 'percent' ? 'fixed' : 'percent')}
            className="text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white hover:bg-gray-50 text-gray-600 min-w-[28px] dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            {discountType === 'percent' ? '%' : '₦'}
          </button>
        </span>
        <span className="font-medium text-red-500">
          {discountAmount > 0 ? `-${formatCurrency(discountAmount, currency)}` : formatCurrency(0, currency)}
        </span>
      </div>
      <div className="flex items-center gap-8 w-64">
        <span className="text-gray-500 flex-1 flex items-center gap-1">
          Tax
          <input
            type="number"
            value={taxRate}
            min={0}
            max={100}
            step="0.1"
            onChange={(e) => onTaxRateChange(parseFloat(e.target.value) || 0)}
            className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 ml-1 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <span className="text-xs">%</span>
        </span>
        <span className="font-medium">{formatCurrency(taxAmount, currency)}</span>
      </div>
      <div className="flex items-center gap-8 w-64 border-t border-gray-300 pt-2 mt-1 dark:border-gray-600">
        <span className="font-bold text-gray-800 flex-1 dark:text-gray-200">Total</span>
        <span className="font-bold text-lg text-gray-900 dark:text-white">{formatCurrency(total, currency)}</span>
      </div>
    </div>
  )
}
