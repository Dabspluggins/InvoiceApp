import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SegmentsManager from './SegmentsManager'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'enyinnayadaberechi@gmail.com'

export default async function SegmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Segments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Build reusable audience segments for targeted announcements.
          </p>
        </div>
        <SegmentsManager />
      </div>
    </div>
  )
}
