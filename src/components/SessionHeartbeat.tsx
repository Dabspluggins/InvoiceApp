'use client'

import { useEffect } from 'react'

export default function SessionHeartbeat() {
  useEffect(() => {
    const beat = () => fetch('/api/sessions/heartbeat', { method: 'POST' }).catch(() => {})
    beat()
    const id = setInterval(beat, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  return null
}
