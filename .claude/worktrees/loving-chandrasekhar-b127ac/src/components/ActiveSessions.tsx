'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Session {
  id: string
  device_type: string | null
  browser: string | null
  ip_address: string | null
  location: string | null
  last_active: string
  created_at: string
  isCurrent?: boolean
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'Mobile') {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" />
      </svg>
    )
  }
  if (type === 'Tablet') {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z" />
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
    </svg>
  )
}

interface RevokeModalProps {
  session: Session
  hasMfa: boolean
  onClose: () => void
  onRevoked: (id: string) => void
}

function RevokeModal({ session, hasMfa, onClose, onRevoked }: RevokeModalProps) {
  const [step, setStep] = useState<'confirm' | 'auth'>('confirm')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRevoke() {
    setLoading(true)
    setError('')
    const body: Record<string, string> = { sessionId: session.id }
    if (hasMfa) body.totpCode = code
    else body.password = password

    const res = await fetch('/api/sessions/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(json.error || 'Failed to revoke session')
      return
    }
    onRevoked(session.id)
    onClose()
  }

  const inputCls = 'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl p-6 w-full max-w-sm">
        {step === 'confirm' ? (
          <>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Sign out this session?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {session.browser} on {session.device_type ?? 'Unknown'} — {session.location ?? session.ip_address ?? 'Unknown location'}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-4 py-2 rounded-lg hover:border-gray-300 dark:hover:border-gray-500 transition-colors">
                Cancel
              </button>
              <button onClick={() => setStep('auth')} className="flex-1 text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Verify your identity</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {hasMfa ? 'Enter your authenticator code to continue.' : 'Enter your password to continue.'}
            </p>
            {hasMfa ? (
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                className={inputCls}
                autoFocus
              />
            ) : (
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
                autoFocus
              />
            )}
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={onClose} className="flex-1 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-4 py-2 rounded-lg hover:border-gray-300 dark:hover:border-gray-500 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={loading || (hasMfa ? code.length !== 6 : !password)}
                className="flex-1 text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ActiveSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMfa, setHasMfa] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Session | null>(null)

  const loadSessions = useCallback(async () => {
    const supabase = createClient()
    const [{ data: { session } }, { data: factors }, { data: rows }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.mfa.listFactors(),
      supabase.from('user_sessions').select('*').order('last_active', { ascending: false }),
    ])

    const hasTotpMfa = (factors?.totp ?? []).some(f => f.status === 'verified')
    setHasMfa(hasTotpMfa)

    if (!session || !rows) { setLoading(false); return }

    const currentHash = await hashToken(session.access_token)
    const enriched = rows.map(r => ({ ...r, isCurrent: r.session_token === currentHash }))
    // Sort current first
    enriched.sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : 0))
    setSessions(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions])

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Active Sessions</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Devices where you&apos;re currently signed in</p>
        </div>
        <div className="p-6">
          {loading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading…</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No session data yet. Sessions are tracked on new sign-ins.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {sessions.map(s => (
                <li key={s.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="text-gray-400 dark:text-gray-500 shrink-0">
                    <DeviceIcon type={s.device_type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {s.browser ?? 'Unknown browser'} on {s.device_type ?? 'Unknown'}
                      </p>
                      {s.isCurrent && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full shrink-0">
                          This device
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                      {s.location ?? s.ip_address ?? 'Unknown location'} · Last active {timeAgo(s.last_active)}
                    </p>
                  </div>
                  {!s.isCurrent && (
                    <button
                      onClick={() => setRevokeTarget(s)}
                      className="shrink-0 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Sign out
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {revokeTarget && (
        <RevokeModal
          session={revokeTarget}
          hasMfa={hasMfa}
          onClose={() => setRevokeTarget(null)}
          onRevoked={id => setSessions(prev => prev.filter(s => s.id !== id))}
        />
      )}
    </>
  )
}

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
