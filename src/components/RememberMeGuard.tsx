'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RememberMeGuard() {
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return
    if (sessionStorage.getItem('remember_me') !== 'false') return

    const handleUnload = () => {
      const supabase = createClient()
      supabase.auth.signOut()
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  return null
}
