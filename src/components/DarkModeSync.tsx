'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DarkModeSync() {
  useEffect(() => {
    async function syncDarkMode() {
      try {
        const supabase = createClient()

        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch dark_mode preference from profiles
        const { data } = await supabase
          .from('profiles')
          .select('dark_mode')
          .eq('id', user.id)
          .single()

        if (data && typeof data.dark_mode === 'boolean') {
          // Apply to DOM
          document.documentElement.classList.toggle('dark', data.dark_mode)
          // Keep localStorage in sync
          localStorage.setItem('theme', data.dark_mode ? 'dark' : 'light')
        }
      } catch {
        // Silently fail — localStorage fallback already applied by inline script
      }
    }

    syncDarkMode()
  }, []) // Run once on every page mount

  return null // Renders nothing
}
