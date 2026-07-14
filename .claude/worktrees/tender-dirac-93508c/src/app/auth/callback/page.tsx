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
    const rawNext = params.get('next') ?? '/dashboard'
    const safeNext = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'
    const code = params.get('code')

    // Fire-and-forget welcome email for new signups (not password resets or email changes)
    function maybeSendWelcomeEmail(flowType: string | null, accessToken?: string) {
      if (flowType !== 'recovery' && flowType !== 'email_change' && accessToken) {
        fetch('/api/welcome-email', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          keepalive: true,
        }).catch(() => {})
      }
    }

    // Primary: token_hash flow — most reliable, works cross-device, no PKCE verifier needed
    if (token_hash && type) {
      supabase.auth.verifyOtp({ token_hash, type }).then(({ data: { session }, error }) => {
        if (!error && session) {
          maybeSendWelcomeEmail(type, session.access_token)
          if (type === 'recovery' || safeNext === '/reset-password') {
            router.replace(
              `/reset-password#access_token=${session.access_token}&refresh_token=${session.refresh_token}`
            )
          } else {
            router.replace(safeNext)
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
          // code flow: recovery is indicated by next=/reset-password
          maybeSendWelcomeEmail(safeNext === '/reset-password' ? 'recovery' : null, session.access_token)
          if (safeNext === '/reset-password') {
            router.replace(
              `/reset-password#access_token=${session.access_token}&refresh_token=${session.refresh_token}`
            )
          } else {
            router.replace(safeNext)
          }
        } else {
          router.replace('/auth/login?error=auth_failed')
        }
      })
      return
    }

    router.replace('/auth/login')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-300 text-sm">Signing you in...</p>
      </div>
    </div>
  )
}
