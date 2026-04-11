import { LineItem, Currency } from './types'
import { getCurrencySymbol } from './currencies'

export function calcTotals(lineItems: LineItem[], taxRate: number, discount = 0, discountType: 'percent' | 'fixed' = 'percent') {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const discountAmount = discountType === 'percent' ? subtotal * (discount / 100) : discount
  const discountedSubtotal = subtotal - discountAmount
  const taxAmount = discountedSubtotal * (taxRate / 100)
  const total = discountedSubtotal + taxAmount
  return { subtotal, discountAmount, taxAmount, total }
}

export function formatCurrency(amount: number, currency: Currency | string): string {
  const symbol = getCurrencySymbol(currency)
  const formatted = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${symbol}${formatted}`
}

export function generateInvoiceNumber(): string {
  const stored = localStorage.getItem('invoice_counter')
  const count = stored ? parseInt(stored) + 1 : 1
  localStorage.setItem('invoice_counter', String(count))
  return `INV-${String(count).padStart(4, '0')}`
}

export function getNextInvoiceNumber(): string {
  if (typeof window === 'undefined') return 'INV-0001'
  const stored = localStorage.getItem('invoice_counter')
  const count = stored ? parseInt(stored) + 1 : 1
  localStorage.setItem('invoice_counter', String(count))
  return `INV-${String(count).padStart(4, '0')}`
}

export function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0, amount: 0 }
}
