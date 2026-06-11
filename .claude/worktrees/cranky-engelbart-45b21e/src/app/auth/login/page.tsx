'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Screen = 'credentials' | 'totp' | 'backup'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [screen, setScreen] = useState<Screen>('credentials')
  const [rememberMe, setRememberMe] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const totpRef = useRef<HTMLInputElement>(null)
  const backupRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleGoogleLogin = async () => {
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

  useEffect(() => {
    if (screen === 'totp') setTimeout(() => totpRef.current?.focus(), 50)
    if (screen === 'backup') setTimeout(() => backupRef.current?.focus(), 50)
  }, [screen])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const rlRes = await fetch('/api/auth/check-rate-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'login' }),
    })
    const rlData = await rlRes.json()
    if (!rlData.allowed) {
      const minutes = Math.ceil(rlData.retryAfter / 60)
      setError(`Too many attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalData?.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
      setLoading(false)
      setScreen('totp')
      return
    }

    if (!rememberMe) sessionStorage.setItem('remember_me', 'false')
    fetch('/api/sessions/register', { method: 'POST' }).catch(() => {})
    router.push('/dashboard')
    router.refresh()
  }

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (totpCode.length !== 6) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totpFactor = factors?.totp?.find(f => f.status === 'verified')

    if (!totpFactor) {
      setError('No authenticator found. Please contact support.')
      setLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: totpFactor.id,
      code: totpCode,
    })

    if (verifyError) {
      setError('Invalid code. Please try again.')
      setTotpCode('')
      totpRef.current?.focus()
      setLoading(false)
      return
    }

    fetch('/api/sessions/register', { method: 'POST' }).catch(() => {})
    router.push('/dashboard')
    router.refresh()
  }

  const handleBackupCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!backupCode.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/mfa/verify-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: backupCode.trim() }),
    })
    const json = await res.json()

    if (!json.valid) {
      setError('Invalid or already-used backup code.')
      setBackupCode('')
      backupRef.current?.focus()
      setLoading(false)
      return
    }

    // Factor was unenrolled server-side; send user to re-enroll
    router.push('/settings?mfa_reset=1')
    router.refresh()
  }

  const inputCls =
    'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-3 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-blue-600">BillByDab</Link>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            {screen === 'credentials' && 'Sign in to your account'}
            {screen === 'totp' && 'Two-factor authentication'}
            {screen === 'backup' && 'Use a backup code'}
          </p>
        </div>

        {/* ── Credentials screen ── */}
        {screen === 'credentials' && (
          <>
            <button
              type="button"
              onClick={handleGoogleLogin}
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
          </>
        )}

        {screen === 'credentials' && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputCls}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputCls} pr-10`}
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
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 accent-blue-600"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Remember me on this device</span>
            </label>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ── TOTP screen ── */}
        {screen === 'totp' && (
          <form onSubmit={handleTotp} className="space-y-5">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enter the 6-digit code from your authenticator app.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Authenticator code</label>
              <input
                ref={totpRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className={inputCls}
              />
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setScreen('backup'); setError('') }}
              className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-center"
            >
              Use a backup code instead
            </button>
          </form>
        )}

        {/* ── Backup code screen ── */}
        {screen === 'backup' && (
          <form onSubmit={handleBackupCode} className="space-y-5">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enter one of your saved backup codes. This will disable 2FA so you can re-enroll with your new device.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup code</label>
              <input
                ref={backupRef}
                type="text"
                value={backupCode}
                onChange={e => setBackupCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                className={inputCls}
              />
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !backupCode.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Use Backup Code'}
            </button>
            <button
              type="button"
              onClick={() => { setScreen('totp'); setError('') }}
              className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-center"
            >
              ← Back to authenticator code
            </button>
          </form>
        )}

        {screen === 'credentials' && (
          <div className="mt-6 text-center space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-blue-600 hover:underline font-medium">Sign up free</Link>
            </p>
            <Link href="/forgot-password" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 block">
              Forgot your password?
            </Link>
            <Link href="/invoice" className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 block">
              Continue without an account →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
