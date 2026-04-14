'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function Nav() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabaseRef.current = supabase

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    if (supabaseRef.current) {
      await supabaseRef.current.auth.signOut()
    }
    setMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 flex items-center justify-between relative print:hidden">
      <Link href="/" className="text-xl font-bold text-indigo-600">BillByDab</Link>

      {/* Desktop nav links */}
      <div className="hidden md:flex gap-6">
        <Link href="/" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm">Home</Link>
        <Link href="/invoice" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm">Invoice Generator</Link>
        {user && <Link href="/dashboard" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm">Dashboard</Link>}
        {user && <Link href="/analytics" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm">Analytics</Link>}
        {user && <Link href="/estimates" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm">Estimates</Link>}
        {user && <Link href="/reports" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm">Reports</Link>}
        {user && <Link href="/clients" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm">Clients</Link>}
        {user && <Link href="/expenses" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm">Expenses</Link>}
        {user && <Link href="/settings" className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm">Settings</Link>}
      </div>

      {/* Desktop auth buttons */}
      <div className="hidden md:flex gap-3">
        {loading ? (
          <div className="w-20 h-9 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ) : user ? (
          <>
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">{user.email}</span>
            <button onClick={handleLogout} className="text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-500">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/auth/login" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-blue-300">Login</Link>
            <Link href="/auth/signup" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Sign Up</Link>
          </>
        )}
      </div>

      {/* Hamburger button (mobile only) */}
      <button
        type="button"
        className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        {menuOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile overlay menu */}
      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg z-50 px-4 py-3 flex flex-col">
          <Link href="/" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium py-3 border-b border-gray-100 dark:border-gray-700" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/invoice" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium py-3 border-b border-gray-100 dark:border-gray-700" onClick={() => setMenuOpen(false)}>Invoice Generator</Link>
          {user && (
            <Link href="/dashboard" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium py-3 border-b border-gray-100 dark:border-gray-700" onClick={() => setMenuOpen(false)}>Dashboard</Link>
          )}
          {user && (
            <Link href="/analytics" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium py-3 border-b border-gray-100 dark:border-gray-700" onClick={() => setMenuOpen(false)}>Analytics</Link>
          )}
          {user && (
            <Link href="/estimates" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium py-3 border-b border-gray-100 dark:border-gray-700" onClick={() => setMenuOpen(false)}>Estimates</Link>
          )}
          {user && (
            <Link href="/reports" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium py-3 border-b border-gray-100 dark:border-gray-700" onClick={() => setMenuOpen(false)}>Reports</Link>
          )}
          {user && (
            <Link href="/clients" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium py-3 border-b border-gray-100 dark:border-gray-700" onClick={() => setMenuOpen(false)}>Clients</Link>
          )}
          {user && (
            <Link href="/expenses" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium py-3 border-b border-gray-100 dark:border-gray-700" onClick={() => setMenuOpen(false)}>Expenses</Link>
          )}
          {user && (
            <Link href="/settings" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium py-3 border-b border-gray-100 dark:border-gray-700" onClick={() => setMenuOpen(false)}>Settings</Link>
          )}
          <div className="pt-3 flex flex-col gap-3">
            {loading ? (
              <div className="w-full h-9 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ) : user ? (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                <button onClick={handleLogout} className="text-sm text-red-600 hover:text-red-700 px-4 py-2 rounded-lg border border-red-200 w-full text-center">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-center" onClick={() => setMenuOpen(false)}>Login</Link>
                <Link href="/auth/signup" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-center" onClick={() => setMenuOpen(false)}>Sign Up</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
