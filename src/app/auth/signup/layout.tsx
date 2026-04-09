import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up Free',
  description: 'Create a free BillByDab account to save and manage your invoices, track payment status, and access your full invoice history.',
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
