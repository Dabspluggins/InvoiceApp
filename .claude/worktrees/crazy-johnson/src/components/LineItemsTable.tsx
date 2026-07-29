'use client'

import { LineItem, Currency } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  items: LineItem[]
  currency: Currency
  onChange: (items: LineItem[]) => void
}

export default function LineItemsTable({ items, currency, onChange }: Props) {
  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    const updated = items.map((item) => {
      if (item.id !== id) return item
      const next = { ...item, [field]: value }
      if (field === 'quantity' || field === 'rate') {
        next.amount = Number(next.quantity) * Number(next.rate)
      }
      return next
    })
    onChange(updated)
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id))
  }

  function addItem() {
    onChange([
      ...items,
      { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0, amount: 0 },
    ])
  }

  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase tracking-wide">
              <th className="pb-2 pr-3 font-medium w-full">Description</th>
              <th className="pb-2 px-3 font-medium whitespace-nowrap">Qty</th>
              <th className="pb-2 px-3 font-medium whitespace-nowrap">Rate</th>
              <th className="pb-2 px-3 font-medium whitespace-nowrap text-right">Amount</th>
              <th className="pb-2 pl-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Item description"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={item.quantity}
                    min={0}
                    onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-16 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </td>
                <td className="py-2 px-3">
                  <input
                    type="number"
                    value={item.rate}
                    min={0}
                    step="0.01"
                    onChange={(e) => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                    className="w-24 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </td>
                <td className="py-2 px-3 text-right font-medium whitespace-nowrap">
                  {formatCurrency(item.amount, currency)}
                </td>
                <td className="py-2 pl-3">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                    aria-label="Remove item"
                  >
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addItem}
        className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
      >
        + Add Item
      </button>
    </div>
  )
}
