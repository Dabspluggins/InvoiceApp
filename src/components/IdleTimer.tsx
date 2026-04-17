'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  idleTimeoutMinutes: number
}

type WarningState = 'none' | 'five_min' | 'countdown'

export default function IdleTimer({ idleTimeoutMinutes }: Props) {
  const router = useRouter()
  const timeoutMs = idleTimeoutMinutes * 60 * 1000
  const warnAt5Min = timeoutMs - 5 * 60 * 1000
  const warnAt60s = timeoutMs - 60 * 1000

  const [warning, setWarning] = useState<WarningState>('none')
  const [countdown, setCountdown] = useState(60)

  const lastActivityRef = useRef(Date.now())
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const signOut = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }, [router])

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now()
    setWarning('none')
    setCountdown(60)
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, resetTimer))
  }, [resetTimer])

  useEffect(() => {
    checkIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current

      if (elapsed >= timeoutMs) {
        signOut()
        return
      }

      if (elapsed >= warnAt60s) {
        setWarning(prev => {
          if (prev !== 'countdown') {
            const remaining = Math.ceil((timeoutMs - elapsed) / 1000)
            setCountdown(remaining)
            if (!countdownIntervalRef.current) {
              countdownIntervalRef.current = setInterval(() => {
                setCountdown(c => {
                  if (c <= 1) {
                    signOut()
                    return 0
                  }
                  return c - 1
                })
              }, 1000)
            }
          }
          return 'countdown'
        })
      } else if (elapsed >= warnAt5Min) {
        setWarning(w => (w === 'none' ? 'five_min' : w))
      }
    }, 5000)

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [timeoutMs, warnAt5Min, warnAt60s, signOut])

  if (warning === 'none') return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-3 pointer-events-none">
      <div className="bg-amber-50 dark:bg-amber-900/90 border border-amber-300 dark:border-amber-600 rounded-xl shadow-lg px-5 py-3 flex items-center gap-4 pointer-events-auto max-w-lg w-full">
        <span className="text-amber-800 dark:text-amber-200 text-sm flex-1">
          {warning === 'five_min'
            ? "You'll be signed out in 5 minutes due to inactivity."
            : `Signing out in ${countdown}…`}
        </span>
        <button
          onClick={resetTimer}
          className="text-sm font-semibold text-amber-900 dark:text-amber-100 bg-amber-200 dark:bg-amber-700 hover:bg-amber-300 dark:hover:bg-amber-600 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          Stay signed in
        </button>
      </div>
    </div>
  )
}
