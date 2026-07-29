'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import DashboardClient from './DashboardClient'
import ProfileDropdown from './ProfileDropdown'

export default function DashboardShell({ user }: { user: User }) {
  const [darkMode, setDarkMode] = useState(false)
  const [themeColor, setThemeColor] = useState('#4F46E5')

  useEffect(() => {
    const saved = localStorage.getItem('dashboard_dark_mode')
    if (saved === 'true') setDarkMode(true)
  }, [])

  function handleSetDarkMode(v: boolean) {
    setDarkMode(v)
    localStorage.setItem('dashboard_dark_mode', v ? 'true' : 'false')
  }

  return (
    <div className={`min-h-screen p-4 md:p-8 transition-colors${darkMode ? ' dark bg-gray-900' : ' bg-gray-50'}`}>
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
