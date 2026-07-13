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
  metadataBase: new URL('https://vortali.com'),
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
    url: 'https://vortali.com',
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
    canonical: 'https://vortali.com',
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
            __html: `
              if(typeof Promise.withResolvers==='undefined'){Promise.withResolvers=function(){var a,b;var p=new Promise(function(r,j){a=r;b=j;});return{promise:p,resolve:a,reject:b};};}
              try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&localStorage.getItem('dashboard_dark_mode')==='true'))document.documentElement.classList.add('dark')}catch(e){}
              (function(){
                function showErr(msg){
                  try{
                    var d=document.getElementById('__jserr');
                    if(!d){
                      d=document.createElement('div');
                      d.id='__jserr';
                      d.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#b91c1c;color:#fff;padding:12px 16px;font:11px/1.5 monospace;z-index:99999;word-break:break-all;white-space:pre-wrap;max-height:40vh;overflow:auto';
                      if(document.body){document.body.appendChild(d);}
                      else{document.addEventListener('DOMContentLoaded',function(){if(document.body)document.body.appendChild(d);});}
                    }
                    d.textContent+=msg+'\n';
                  }catch(_){}
                }
                window.addEventListener('error',function(e){
                  showErr((e.message||'unknown error')+' @ '+(e.filename||'?').split('/').pop()+':'+(e.lineno||'?'));
                },true);
                window.addEventListener('unhandledrejection',function(e){
                  var r=e.reason;
                  var msg=r?(r.stack||r.message||String(r)):'unhandled rejection';
                  showErr('Promise rejection: '+msg);
                });
              })();
            `,
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
