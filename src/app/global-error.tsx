'use client'

/**
 * Global error boundary — catches errors thrown inside the root layout itself
 * (PostHogProvider, Nav, etc.). This replaces the entire document, so it must
 * include its own <html> and <body> tags. Inline styles are used because
 * Tailwind / global CSS may not be available when the root layout fails.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f9fafb' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: '24rem',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #e5e7eb',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#111827' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              An unexpected error occurred.
            </p>
            {error.digest && (
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'monospace', marginBottom: '1.5rem' }}>
                Ref: {error.digest}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => reset()}
                style={{
                  width: '100%',
                  background: '#2563eb',
                  color: 'white',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  width: '100%',
                  display: 'block',
                  border: '1px solid #e5e7eb',
                  color: '#374151',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  boxSizing: 'border-box' as const,
                }}
              >
                Back to home
              </a>
            </div>
            <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#9ca3af' }}>
              Still happening?{' '}
              <a href="mailto:support@vortali.com" style={{ color: '#3b82f6' }}>
                support@vortali.com
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
