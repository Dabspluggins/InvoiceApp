'use client'

import { useState } from 'react'

interface Props {
  children: React.ReactNode
  isLocked: boolean
  className?: string
}

export default function LockedFeature({ children, isLocked, className = '' }: Props) {
  const [toastVisible, setToastVisible] = useState(false)

  if (!isLocked) return <>{children}</>

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!toastVisible) {
      setToastVisible(true)
      setTimeout(() => setToastVisible(false), 2500)
    }
  }

  return (
    <>
      <div className={`relative group ${className}`}>
        <div className="opacity-50 pointer-events-none select-none">
          {children}
        </div>
        {/* Click interceptor */}
        <div
          className="absolute inset-0 cursor-pointer z-10"
          onClick={handleClick}
        />
        {/* Lock badge */}
        <span className="absolute -top-1.5 -right-1.5 text-xs z-20 pointer-events-none leading-none">
          🔒
        </span>
        {/* Hover tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-20">
          Sign in to unlock
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      </div>
      {/* Toast */}
      {toastVisible && (
        <div className="fixed top-4 right-4 z-[100] px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-lg">
          Sign in to unlock this feature
        </div>
      )}
    </>
  )
}
