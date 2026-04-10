'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Universal auth callback handler — runs entirely in the browser so it can
 * read URL hash fragments (implicit/legacy Supabase flow) as well as the
 * ?code= query param (PKCE flow).  A server-side Route Handler can never
 * receive hash fragments because browsers strip them before sending the HTTP
 * request, which is why the previous route.ts silently fell back to /auth/login.
 */
export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const next = params.get('next') ?? '/dashboard'

    // PKCE flow — Supabase put a one-time code in ?code=
    // The browser client has the code_verifier available (localStorage/cookie)
    // so exchangeCodeForSession works even when the user opens the link on a
    // different device than where they initiated the reset.
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data: { session }, error }) => {
        if (!error && session && next === '/reset-password') {
          router.replace(
            `/reset-password?access_token=${session.access_token}&refresh_token=${session.refresh_token}`
          )
        } else if (!error) {
          router.replace(next)
        } else {
          router.replace('/auth/login?error=link_expired')
        }
      })
      return
    }

    // Implicit / legacy flow — Supabase puts tokens in the URL hash fragment
    // e.g. #access_token=XXX&refresh_token=YYY&type=recovery
    const hash = window.location.hash
    if (hash) {
      const hashParams = new URLSearchParams(hash.slice(1))
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
          if (!error) {
            if (type === 'recovery' || next === '/reset-password') {
              // Pass tokens forward so reset-password page can re-establish
              // the session after the client-side navigation clears it.
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

    // Nothing usable in URL
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
