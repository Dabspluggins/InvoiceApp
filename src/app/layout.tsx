import type { Metadata } from 'next'
import { Inter, Pacifico } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import DarkModeSync from '@/components/DarkModeSync'
import IdleTimerLoader from '@/components/IdleTimerLoader'
import RememberMeGuard from '@/components/RememberMeGuard'
import SessionHeartbeat from '@/components/SessionHeartbeat'
import PostHogProvider from '@/components/PostHogProvider'

const inter = Inter({ subsets: ['latin'] })
const pacifico = Pacifico({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-pacifico',
})

export const metadata: Metadata = {
  title: {
    default: 'Vortali — Free Invoice Generator for Freelancers',
    template: '%s | Vortali',
  },
  description:
    'Create and send professional invoices for free. Vortali is the easiest free invoice generator for freelancers, brands, and small businesses. No signup required to start.',
  keywords: [
    'free invoice generator',
    'invoice generator online',
    'free invoice maker',
    'invoice template',
    'freelancer invoice',
    'small business invoice',
  ],
  authors: [{ name: 'Vortali' }],
  creator: 'Vortali',
  metadataBase: new URL('https://www.vortali.com'),
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.vortali.com',
    siteName: 'Vortali',
    title: 'Vortali — Free Invoice Generator for Freelancers',
    description:
      'Create and send professional invoices for free. The easiest invoice generator for freelancers and small businesses.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vortali — Free Invoice Generator Online',
    description: 'Create and send professional invoices for free.',
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
    canonical: 'https://www.vortali.com',
  },
  verification: {
    google: 'Vj2ZbW5Vaauc_l98V1ZsAVbgQnfWyeeivmzwvjY2F94',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&localStorage.getItem('dashboard_dark_mode')==='true'))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.className} ${pacifico.variable} min-h-full bg-gray-50 dark:bg-gray-900 antialiased`} suppressHydrationWarning>
        <PostHogProvider>
          <Nav />
          <DarkModeSync />
          <RememberMeGuard />
          <IdleTimerLoader />
          <SessionHeartbeat />
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
