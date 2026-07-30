'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function Nav() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
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
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-xl font-bold text-blue-600">InvoiceFree</Link>
      <div className="flex gap-6">
        <Link href="/" className="text-gray-600 hover:text-blue-600 text-sm">Home</Link>
        <Link href="/invoice" className="text-gray-600 hover:text-blue-600 text-sm">Invoice Generator</Link>
        {user && <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 text-sm">Dashboard</Link>}
      </div>
      <div className="flex gap-3">
        {loading ? (
          <div className="w-20 h-9 bg-gray-100 rounded-lg animate-pulse" />
        ) : user ? (
          <>
            <span className="text-sm text-gray-500 hidden md:flex items-center">{user.email}</span>
            <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-red-600 px-4 py-2 rounded-lg border border-gray-300 hover:border-red-300">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-blue-600 px-4 py-2 rounded-lg border border-gray-300 hover:border-blue-300">Login</Link>
            <Link href="/auth/signup" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  )
}
