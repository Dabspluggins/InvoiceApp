import type { NextRequest } from 'next/server'
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

export function escHtml(s: string | null | undefined): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// On Vercel, request.ip is the trusted observed client IP.
// Fallback: last value in X-Forwarded-For — Vercel appends the trusted IP at the end,
// so reading the first value is attacker-controlled and must not be used.
export function getTrustedIp(req: Request | NextRequest): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ('ip' in req && typeof (req as any).ip === 'string') {
    return (req as any).ip as string
  }
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return '127.0.0.1'
}
