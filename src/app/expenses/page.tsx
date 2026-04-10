import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExpensesClient from '@/components/ExpensesClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Expenses',
  robots: { index: false, follow: false },
}

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <ExpensesClient />
      </div>
    </div>
  )
}
