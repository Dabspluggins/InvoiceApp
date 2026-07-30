'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RememberMeGuard() {
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return
    if (sessionStorage.getItem('remember_me') !== 'false') return

    // Use pagehide instead of beforeunload so that normal navigations and
    // hard reloads do not sign the user out. pagehide with persisted=false
    // fires only when the page is truly being discarded (tab/window close,
    // navigation away from the app), not when it enters the bfcache.
    // The visibilityState guard adds an extra check that the tab is hidden,
    // filtering out cases where the event fires while the tab is still visible.
    const handlePageHide = (e: PageTransitionEvent) => {
      if (e.persisted) return // page is entering bfcache, not closing
      if (document.visibilityState !== 'hidden') return
      const supabase = createClient()
      supabase.auth.signOut()
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [])

  return null
}
