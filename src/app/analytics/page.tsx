import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AnalyticsClient from '@/components/AnalyticsClient'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-500 text-sm mt-1">Business performance overview</p>
          </div>
          <Link
            href="/dashboard"
            className="self-start sm:self-auto text-sm text-gray-600 hover:text-blue-600 px-5 py-2.5 rounded-lg border border-gray-300 hover:border-blue-300"
          >
            ← Dashboard
          </Link>
        </div>

        <AnalyticsClient />
      </div>
    </div>
  )
}
