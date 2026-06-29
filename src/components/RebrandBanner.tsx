'use client'

import { useState, useEffect } from 'react'

const BANNER_KEY = 'vortali_rebrand_seen'

export default function RebrandBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(BANNER_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(BANNER_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="mb-6 flex items-start sm:items-center justify-between gap-4 rounded-lg bg-indigo-600 px-5 py-3 text-white text-sm">
      <p className="leading-snug">
        <span className="font-semibold">BillByDab is now Vortali.</span>{' '}
        Same product, same data — just a new name and a new home at{' '}
        <a
          href="https://www.vortali.com"
          className="underline underline-offset-2 hover:text-indigo-200 transition-colors"
        >
          vortali.com
        </a>
        . Your account, invoices, and clients are exactly as you left them.
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss rebrand notice"
        className="shrink-0 rounded-full p-1 hover:bg-white/20 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
        </svg>
      </button>
    </div>
  )
}
