import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Invoice — Free Invoice Generator',
  description: 'Create a professional invoice for free. Fill in your details, add line items, and download as PDF instantly — no account required.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function InvoiceLayout({ children }: { children: React.ReactNode }) {
  return children
}
