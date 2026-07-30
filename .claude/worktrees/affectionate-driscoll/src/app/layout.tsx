import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BillByDab — Invoice clients. Get paid faster.',
  description: 'Create professional invoices in seconds. Free forever, no credit card required. Download as PDF instantly.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full bg-gray-50 antialiased`}>
        <Nav />
        {children}
      </body>
    </html>
  )
}
