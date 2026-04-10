'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type') as 'recovery' | 'signup' | 'invite' | 'magiclink' | 'email' | null
    const next = params.get('next') ?? '/dashboard'
    const code = params.get('code')

    // Primary: token_hash flow — most reliable, works cross-device, no PKCE verifier needed
    if (token_hash && type) {
      supabase.auth.verifyOtp({ token_hash, type }).then(({ data: { session }, error }) => {
        if (!error && session) {
          if (type === 'recovery' || next === '/reset-password') {
            router.replace(
              `/reset-password?access_token=${session.access_token}&refresh_token=${session.refresh_token}`
            )
          } else {
            router.replace(next)
          }
        } else {
          router.replace('/auth/login?error=link_expired')
        }
      })
      return
    }

    // Secondary: PKCE code flow
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data: { session }, error }) => {
        if (!error && session) {
          if (next === '/reset-password') {
            router.replace(
              `/reset-password?access_token=${session.access_token}&refresh_token=${session.refresh_token}`
            )
          } else {
            router.replace(next)
          }
        } else {
          router.replace('/auth/login?error=link_expired')
        }
      })
      return
    }

    // Tertiary: implicit hash fragment flow
    const hash = window.location.hash
    if (hash) {
      const hashParams = new URLSearchParams(hash.slice(1))
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      const hashType = hashParams.get('type')

      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (!error) {
            if (hashType === 'recovery' || next === '/reset-password') {
              router.replace(
                `/reset-password?access_token=${access_token}&refresh_token=${refresh_token}`
              )
            } else {
              router.replace(next)
            }
          } else {
            router.replace('/auth/login?error=link_expired')
          }
        })
        return
      }
    }

    router.replace('/auth/login')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
