import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReportsClient from '@/components/ReportsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tax & Reports',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax &amp; Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Year-end and quarterly summaries for accounting</p>
        </div>

        <ReportsClient />
      </div>
    </div>
  )
}
