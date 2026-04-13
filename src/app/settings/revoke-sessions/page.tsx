import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function ResultPage({ success, message }: { success: boolean; message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
            success ? 'bg-green-100' : 'bg-red-100'
          }`}
        >
          {success ? (
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <p className="text-gray-900 font-medium mb-6">{message}</p>
        <Link
          href="/settings"
          className="inline-block text-sm bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Back to Settings
        </Link>
      </div>
    </div>
  )
}

export default async function RevokeSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return <ResultPage success={false} message="This link is invalid or has expired." />
  }

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-700 mb-6">Please sign in to use this link.</p>
          <Link
            href={`/auth/login?next=/settings/revoke-sessions?token=${encodeURIComponent(token)}`}
            className="inline-block text-sm bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify token belongs to this user and hasn't expired
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, revoke_token_expires_at')
    .eq('id', session.user.id)
    .eq('revoke_token', token)
    .gt('revoke_token_expires_at', new Date().toISOString())
    .single()

  if (!profile) {
    return <ResultPage success={false} message="This link is invalid or has expired." />
  }

  // Sign out all other sessions (keep the current one)
  const { error: signOutError } = await adminClient.auth.admin.signOut(
    session.access_token,
    'others'
  )

  // Clear the token regardless of signout result
  await adminClient
    .from('profiles')
    .update({ revoke_token: null, revoke_token_expires_at: null })
    .eq('id', session.user.id)

  if (signOutError) {
    console.error('revoke-sessions signout error:', signOutError)
    return <ResultPage success={false} message="Failed to sign out other devices. Please try again." />
  }

  return <ResultPage success={true} message="All other devices have been signed out." />
}
