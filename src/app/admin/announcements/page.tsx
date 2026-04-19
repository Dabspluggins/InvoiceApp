import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AnnouncementComposer from '@/components/AnnouncementComposer'
import AnnouncementHistory from '@/components/AnnouncementHistory'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'enyinnayadaberechi@gmail.com'

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Announcements</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Send product updates to all subscribed users.</p>
        </div>

        <AnnouncementComposer />

        <AnnouncementHistory />
      </div>
    </div>
  )
}
