'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import DashboardClient from './DashboardClient'
import ProfileDropdown from './ProfileDropdown'
import RebrandBanner from './RebrandBanner'
import VortaliLogo from './VortaliLogo'

export default function DashboardShell({ user }: { user: User }) {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || (saved === null && localStorage.getItem('dashboard_dark_mode') === 'true')
  })
  const [themeColor, setThemeColor] = useState('#4F46E5')
  const supabase = createClient()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)

    const client = createClient()
    let cancelled = false
    client
      .from('profiles')
      .select('dark_mode, welcome_sent')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        if (!data || !data.welcome_sent) {
          fetch('/api/welcome-email', { method: 'POST' }).catch(() => {})
        }
        if (data && typeof data.dark_mode === 'boolean') {
          const dbDark = data.dark_mode
          setDarkMode(prev => (prev === dbDark ? prev : dbDark))
          document.documentElement.classList.toggle('dark', dbDark)
          localStorage.setItem('theme', dbDark ? 'dark' : 'light')
        }
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  function handleSetDarkMode(v: boolean) {
    setDarkMode(v)
    document.documentElement.classList.toggle('dark', v)
    localStorage.setItem('theme', v ? 'dark' : 'light')

    supabase
      .from('profiles')
      .upsert({ id: user.id, dark_mode: v }, { onConflict: 'id' })
      .then(() => {})
  }

  return (
    <div className="min-h-screen p-4 md:p-8 transition-colors bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center gap-3 mb-6 md:mb-8">
          <VortaliLogo
            height={32}
            textColor={darkMode ? '#f8fafc' : '#0f172a'}
          />
          <div className="flex items-center gap-3">
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
        </div>

        <RebrandBanner />
        <DashboardClient user={user} darkMode={darkMode} />
      </div>
    </div>
  )
}
