import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import AnnouncementsClient from './AnnouncementsClient'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'enyinnayadaberechi@gmail.com'

type Announcement = {
  id: string
  title: string
  body: string
  sent_at: string
  sent_by: string | null
  recipient_count: number
}

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: announcements } = await admin
    .from('announcements')
    .select('id, title, body, sent_at, sent_by, recipient_count')
    .order('sent_at', { ascending: false })
    .limit(50)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Product Announcements</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Send product updates to all subscribed users.</p>
        </div>

        <AnnouncementsClient announcements={(announcements as Announcement[]) ?? []} />
      </div>
    </div>
  )
}
