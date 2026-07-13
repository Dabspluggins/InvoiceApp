'use client'

import { useEffect } from 'react'

/**
 * Route-level error boundary for the Next.js App Router.
 *
 * Catches runtime errors thrown during rendering of any page component.
 * Without this file, a page crash shows a completely blank white screen —
 * with it, users get a recoverable error UI and Sentry captures the digest.
 *
 * For errors in the root layout itself, see global-error.tsx.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // @sentry/nextjs captures this automatically; console.error aids local debugging
    console.error('[Page Error]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 w-full max-w-md text-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          We hit an unexpected error loading this page.
        </p>

        {error.digest && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 font-mono">
            Ref: {error.digest}
          </p>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={() => reset()}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="w-full border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors block"
          >
            Back to home
          </a>
        </div>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          If this keeps happening, contact{' '}
          <a
            href="mailto:support@vortali.com"
            className="text-blue-500 hover:underline"
          >
            support@vortali.com
          </a>
        </p>
      </div>
    </div>
  )
}
