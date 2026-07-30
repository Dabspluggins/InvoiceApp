'use client'

import { Currency } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  currency: Currency
  onTaxRateChange: (rate: number) => void
}

export default function Totals({ subtotal, taxRate, taxAmount, total, currency, onTaxRateChange }: Props) {
  return (
    <div className="mt-4 flex flex-col items-end gap-1.5 text-sm">
      <div className="flex items-center gap-8 w-64">
        <span className="text-gray-500 flex-1">Subtotal</span>
        <span className="font-medium">{formatCurrency(subtotal, currency)}</span>
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
            className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 ml-1"
          />
          <span className="text-xs">%</span>
        </span>
        <span className="font-medium">{formatCurrency(taxAmount, currency)}</span>
      </div>
      <div className="flex items-center gap-8 w-64 border-t border-gray-300 pt-2 mt-1">
        <span className="font-bold text-gray-800 flex-1">Total</span>
        <span className="font-bold text-lg text-gray-900">{formatCurrency(total, currency)}</span>
      </div>
    </div>
  )
}
