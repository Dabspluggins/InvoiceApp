import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EstimateEditor from '@/components/EstimateEditor'

export const dynamic = 'force-dynamic'

export default async function NewEstimatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return <EstimateEditor />
}
