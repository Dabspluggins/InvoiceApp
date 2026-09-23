import { createClient } from '@supabase/supabase-js'
import EstimateReviewClient from '@/components/EstimateReviewClient'

interface LineItemRow {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  deleted_by_client: boolean
  sort_order: number
}

interface EstimateRow {
  id: string
  estimate_number: string
  title: string | null
  status: string
  valid_until: string | null
  client_name: string | null
  client_email: string | null
  client_token: string
  currency: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_type: string
  discount_value: number
  discount_amount: number
  total: number
  notes: string | null
  terms: string | null
  user_id: string
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function EstimateReviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Invalid Link</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            This estimate link is missing a required token. Please check your email for the
            original link.
          </p>
        </div>
      </div>
    )
  }

  const supabase = getServiceClient()

  // The share token is the only credential. client_token carries a UNIQUE
  // constraint (see 20260428000000_stabilize_core_schema.sql), so it resolves
  // to exactly one estimate — the estimate id is never taken from the URL.
  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('client_token', token)
    .single()

  if (!estimate) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Estimate Not Found</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            This estimate link is invalid or has expired. Please contact the sender.
          </p>
        </div>
      </div>
    )
  }

  // Every lookup below keys off the row we just authenticated, not the URL.
  const id: string = estimate.id

  if (estimate.status === 'converted') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Estimate Converted</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            This estimate has already been processed and converted to an invoice.
          </p>
        </div>
      </div>
    )
  }

  const { data: lineItems } = await supabase
    .from('estimate_line_items')
    .select('*')
    .eq('estimate_id', id)
    .eq('deleted_by_client', false)
    .order('sort_order')

  // Opening this page records nothing. The "client opened your estimate"
  // signal is fired by EstimateReviewClient on mount, via
  // POST /api/e/[token]/view — mail scanners follow emailed links but do not
  // run JavaScript, so a render-time write would report views that never
  // happened. That endpoint is also first-view-only, so reloads don't
  // re-notify the owner.

  return (
    <EstimateReviewClient
      estimate={estimate as EstimateRow}
      lineItems={(lineItems || []) as LineItemRow[]}
      token={token}
    />
  )
}
