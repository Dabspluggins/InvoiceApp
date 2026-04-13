import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'BillByDab — Free Invoice Generator for Freelancers',
    template: '%s | BillByDab',
  },
  description:
    'Create and send professional invoices for free. BillByDab is the easiest free invoice generator for freelancers, brands, and small businesses. No signup required to start.',
  keywords: [
    'free invoice generator',
    'invoice generator online',
    'free invoice maker',
    'invoice template',
    'freelancer invoice',
    'small business invoice',
  ],
  authors: [{ name: 'BillByDab' }],
  creator: 'BillByDab',
  metadataBase: new URL('https://www.billbydab.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.billbydab.com',
    siteName: 'BillByDab',
    title: 'BillByDab — Free Invoice Generator for Freelancers',
    description:
      'Create and send professional invoices for free. The easiest invoice generator for freelancers and small businesses.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BillByDab Free Invoice Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BillByDab — Free Invoice Generator Online',
    description: 'Create and send professional invoices for free.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  alternates: {
    canonical: 'https://www.billbydab.com',
  },
  verification: {
    google: 'Vj2ZbW5Vaauc_l98V1ZsAVbgQnfWyeeivmzwvjY2F94',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}` }} />
      </head>
      <body className={`${inter.className} min-h-full bg-gray-50 dark:bg-gray-900 antialiased`}>
        <Nav />
        {children}
      </body>
    </html>
  )
}
