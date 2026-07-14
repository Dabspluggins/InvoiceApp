import { LineItem, Currency } from './types'

export function calcTotals(lineItems: LineItem[], taxRate: number) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount
  return { subtotal, taxAmount, total }
}

export function formatCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
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
