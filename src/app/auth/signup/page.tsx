'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!scriptReady || !turnstileRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ts = (window as any).turnstile
    if (!ts) return
    turnstileWidgetIdRef.current = ts.render(turnstileRef.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
      callback: (token: string) => setCaptchaToken(token),
      'expired-callback': () => setCaptchaToken(null),
      'error-callback': () => setCaptchaToken(null),
    })
  }, [scriptReady])

  const resetCaptcha = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ts = (window as any).turnstile
    if (ts && turnstileWidgetIdRef.current) ts.reset(turnstileWidgetIdRef.current)
    setCaptchaToken(null)
  }

  const handleGoogleSignup = async () => {
    setOauthLoading(true)
    setError('')
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (oauthError) {
      setError(oauthError.message)
      setOauthLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters')
      setLoading(false)
      return
    }

    try {
      const rlRes = await fetch('/api/auth/check-rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'signup' }),
      })
      if (!rlRes.ok) throw new Error('rate-limit check failed')
      const rlData = await rlRes.json()
      if (!rlData.allowed) {
        const minutes = Math.ceil((rlData.retryAfter as number) / 60)
        setError(
          Number.isFinite(minutes)
            ? `Too many attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`
            : 'Too many attempts. Please try again later.'
        )
        setLoading(false)
        return
      }
    } catch {
      setError('Too many attempts. Please try again later.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        captchaToken: captchaToken!,
      },
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Check your email</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <Link href="/auth/login" className="text-blue-600 hover:underline text-sm">Back to login</Link>
        </div>
      </div>
    )
  }

  return (
    <>
    <Script
      src="https://challenges.cloudflare.com/turnstile/v0/api.js"
      strategy="lazyOnload"
      onLoad={() => setScriptReady(true)}
    />
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-blue-600">BillByDab</Link>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Create your free account</p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={oauthLoading || loading}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
        >
          {oauthLoading ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          )}
          {oauthLoading ? 'Redirecting...' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 12 characters"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 pr-10 text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 pr-10 text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div ref={turnstileRef} />
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
            {loading ? 'Creating account...' : 'Create Free Account'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
          </p>
          <Link href="/invoice" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 block">
            Continue without an account →
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}
