'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    window.onloadTurnstileCallback = () => {
      if (!turnstileRef.current) return
      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      if (!siteKey) {
        setCaptchaError(true)
        return
      }
      turnstileWidgetIdRef.current = window.turnstile!.render(
        turnstileRef.current,
        {
          sitekey: siteKey,
          callback:           (token: string) => { setCaptchaToken(token); setCaptchaError(false) },
          'expired-callback': () => setCaptchaToken(null),
          'error-callback':   () => { setCaptchaToken(null); setCaptchaError(true) },
          retry:              'auto',
        }
      )
    }
    if (typeof window.turnstile !== 'undefined') {
      window.onloadTurnstileCallback?.()
    }
    return () => {
      delete window.onloadTurnstileCallback
      const widgetId = turnstileWidgetIdRef.current
      if (widgetId != null) {
        window.turnstile?.remove(widgetId)
        turnstileWidgetIdRef.current = null
      }
    }
  }, [])

  const resetCaptcha = () => {
    const widgetId = turnstileWidgetIdRef.current
    if (widgetId != null) window.turnstile?.reset(widgetId)
    setCaptchaToken(null)
    setCaptchaError(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!captchaToken) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      captchaToken,
    })

    if (error) {
      setError(error.message)
      resetCaptcha()
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Check your inbox</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            We&apos;ve sent a password reset link to <strong>{email}</strong>.
          </p>
          <Link href="/auth/login" className="text-blue-600 hover:underline text-sm">Back to login</Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <Script
        id="cf-turnstile-script-forgot"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onloadTurnstileCallback"
        strategy="afterInteractive"
      />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-bold text-blue-600">Vortali</Link>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Reset your password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div ref={turnstileRef} />
            {captchaError && (
              <p className="text-red-500 text-xs mt-1">Security check failed — please refresh and try again.</p>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !captchaToken}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>

            {!captchaToken && !captchaError && !loading && (
              <p className="text-center text-xs text-gray-400">Complete the security check above to continue.</p>
            )}
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">Back to login</Link>
          </div>
        </div>
      </div>
    </>
  )
}
