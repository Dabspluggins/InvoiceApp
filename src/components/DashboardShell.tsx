'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import DashboardClient from './DashboardClient'
import ProfileDropdown from './ProfileDropdown'

export default function DashboardShell({ user }: { user: User }) {
  const [darkMode, setDarkMode] = useState(false)
  const [themeColor, setThemeColor] = useState('#4F46E5')
  const supabase = createClient()

  useEffect(() => {
    // Fast: apply localStorage immediately to avoid flash
    const saved = localStorage.getItem('theme')
    const localDark = saved === 'dark' || (saved === null && localStorage.getItem('dashboard_dark_mode') === 'true')
    if (localDark) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }

    // Reliable: fetch from Supabase and use as source of truth
    supabase
      .from('profiles')
      .select('dark_mode')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data && typeof data.dark_mode === 'boolean') {
          const dbDark = data.dark_mode
          setDarkMode(dbDark)
          document.documentElement.classList.toggle('dark', dbDark)
          localStorage.setItem('theme', dbDark ? 'dark' : 'light')
        }
      })
  }, [user.id])

  function handleSetDarkMode(v: boolean) {
    // Apply immediately
    setDarkMode(v)
    document.documentElement.classList.toggle('dark', v)
    localStorage.setItem('theme', v ? 'dark' : 'light')

    // Persist to Supabase for cross-device sync
    supabase
      .from('profiles')
      .upsert({ id: user.id, dark_mode: v }, { onConflict: 'id' })
      .then(() => {}) // fire and forget
  }

  return (
    <div className="min-h-screen p-4 md:p-8 transition-colors bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-end items-center gap-3 mb-6 md:mb-8">
          <ProfileDropdown
            user={user}
            darkMode={darkMode}
            setDarkMode={handleSetDarkMode}
            onThemeChange={setThemeColor}
          />
          <Link
            href="/invoice"
            className="self-start sm:self-auto text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition"
            style={{ backgroundColor: themeColor }}
          >
            + New Invoice
          </Link>
        </div>

        <DashboardClient user={user} darkMode={darkMode} />
      </div>
    </div>
  )
}
