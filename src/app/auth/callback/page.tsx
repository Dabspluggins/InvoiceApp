'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function Spinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const supabase = createClient()
    const next = searchParams.get('next') ?? '/dashboard'
    const code = searchParams.get('code')

    async function handle() {
      // PKCE flow — Supabase sends ?code= in the query string
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          router.replace('/auth/login?error=link_expired')
          return
        }
        router.replace(next)
        return
      }

      // Implicit / recovery flow — Supabase sends #access_token= in the hash.
      // Hash fragments are never sent to the server, so route.ts can't see them.
      // We read them here in the browser instead.
      const hash = window.location.hash
      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1))
        const access_token = hashParams.get('access_token')
        const refresh_token = hashParams.get('refresh_token')
        const type = hashParams.get('type')

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) {
            router.replace('/auth/login?error=link_expired')
            return
          }
          // type=recovery means this is a password reset link
          router.replace(type === 'recovery' ? '/reset-password' : next)
          return
        }
      }

      // Nothing useful in URL — send to login
      router.replace('/auth/login')
    }

    handle()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <Spinner />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackHandler />
    </Suspense>
  )
}
