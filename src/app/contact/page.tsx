import type { Metadata } from 'next'
import ContactClient from './ContactClient'

export const metadata: Metadata = {
  title: 'Contact Us — Vortali',
  description: 'Get in touch with the Vortali team. We respond within 24 hours, Monday to Sunday.',
  alternates: {
    canonical: 'https://www.vortali.com/contact',
  },
}

export default function ContactPage() {
  return <ContactClient />
}
