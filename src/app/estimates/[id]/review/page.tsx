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
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { id } = await params
  const { token } = await searchParams

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

  // Verify token matches — never trust ID alone
  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
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

  // Log client_viewed event
  await supabase
    .from('estimate_events')
    .insert({
      estimate_id: id,
      event_type: 'client_viewed',
      actor: 'client',
      details: { at: new Date().toISOString() },
    })

  // Update status to client_reviewing if currently 'sent'
  if (estimate.status === 'sent') {
    await supabase
      .from('estimates')
      .update({ status: 'client_reviewing', updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  // Notify owner that client opened the estimate
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      const { data: userData } = await supabase.auth.admin.getUserById(estimate.user_id)
      const ownerEmail = userData?.user?.email
      if (ownerEmail) {
        const { Resend } = await import('resend')
        const resend = new Resend(apiKey)
        const clientDisplayName = estimate.client_name || 'Your client'
        await resend.emails.send({
          from: 'BillByDab <noreply@billbydab.com>',
          to: ownerEmail,
          subject: `${clientDisplayName} has opened estimate ${estimate.estimate_number}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #4F46E5;">Estimate Opened</h2>
              <p><strong>${clientDisplayName}</strong> has just opened and is reviewing your estimate <strong>${estimate.estimate_number}</strong>.</p>
              ${estimate.title ? `<p style="color: #6B7280;">${estimate.title}</p>` : ''}
              <p>They may approve, edit, or send back a revised version soon.</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://www.billbydab.com'}/estimates/${estimate.id}"
                 style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
                View Estimate
              </a>
            </div>
          `,
        })
      }
    }
  } catch (notifyErr) {
    console.error('Failed to send owner open notification:', notifyErr)
  }

  return (
    <EstimateReviewClient
      estimate={estimate as EstimateRow}
      lineItems={(lineItems || []) as LineItemRow[]}
      token={token}
    />
  )
}
