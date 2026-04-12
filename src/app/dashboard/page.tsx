import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'

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

  return <DashboardShell user={user} />
}
