import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardClient from '@/components/DashboardClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: {
    index: false,
    follow: false,
  },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-end mb-6 md:mb-8">
          <Link
            href="/invoice"
            className="self-start sm:self-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            + New Invoice
          </Link>
        </div>

        <DashboardClient user={user} />
      </div>
    </div>
  )
}
