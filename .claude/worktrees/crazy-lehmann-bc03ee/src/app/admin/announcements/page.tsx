import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import AnnouncementComposer from '@/components/AnnouncementComposer'

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

  // Fetch past announcements using service role so RLS doesn't block
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

        <AnnouncementComposer />

        {/* Past announcements */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Sent Announcements</h2>
          </div>
          {!announcements || announcements.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-gray-400">No announcements sent yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Title</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
                    <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Recipients</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {(announcements as Announcement[]).map(a => (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 text-gray-900 dark:text-white font-medium max-w-xs truncate">{a.title}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(a.sent_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900 dark:text-white font-medium">
                        {a.recipient_count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
