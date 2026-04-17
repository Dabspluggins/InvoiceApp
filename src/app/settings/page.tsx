import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/SettingsClient'
import type { AuditLog } from '@/components/SettingsClient'

export const dynamic = 'force-dynamic'

export interface TrustedDevice {
  id: string
  device_fingerprint: string
  label: string | null
  created_at: string
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const [auditResult, profileResult, devicesResult] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('profiles')
      .select('login_alerts_enabled')
      .eq('id', user.id)
      .maybeSingle(),
    admin
      .from('trusted_devices')
      .select('id, device_fingerprint, label, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const loginAlertsEnabled = profileResult.data?.login_alerts_enabled ?? true
  const trustedDevices = (devicesResult.data ?? []) as TrustedDevice[]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <SettingsClient
          user={user}
          auditLogs={(auditResult.data ?? []) as AuditLog[]}
          loginAlertsEnabled={loginAlertsEnabled}
          trustedDevices={trustedDevices}
        />
      </div>
    </div>
  )
}
