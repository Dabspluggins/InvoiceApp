'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import IdleTimer from './IdleTimer'

export default function IdleTimerLoader() {
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('idle_timeout_minutes')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.idle_timeout_minutes) {
            setIdleTimeoutMinutes(data.idle_timeout_minutes)
          }
        })
    })
  }, [])

  if (!idleTimeoutMinutes) return null
  return <IdleTimer idleTimeoutMinutes={idleTimeoutMinutes} />
}
