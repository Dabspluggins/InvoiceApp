import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/SettingsClient'
import type { AuditLog } from '@/components/SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('id, action, entity_type, entity_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <SettingsClient user={user} auditLogs={(auditLogs ?? []) as AuditLog[]} />
      </div>
    </div>
  )
}
