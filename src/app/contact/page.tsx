import type { Metadata } from 'next'
import ContactClient from './ContactClient'

export const metadata: Metadata = {
  title: 'Contact Us — BillByDab',
  description: 'Get in touch with the BillByDab team. We respond within 24 hours, Monday to Sunday.',
  alternates: {
    canonical: 'https://www.billbydab.com/contact',
  },
}

export default function ContactPage() {
  return <ContactClient />
}
