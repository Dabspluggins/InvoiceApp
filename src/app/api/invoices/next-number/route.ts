import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logger'

/**
 * GET /api/invoices/next-number
 *
 * Returns the next invoice number for the authenticated user WITHOUT allocating it.
 * Used by the UI to pre-fill the invoice number field before the user saves.
 *
 * Allocation (incrementing the sequence) happens inside next_invoice_number() with
 * p_peek=false — called from the estimate convert route and the recurring cron when
 * an invoice is actually being created.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.rpc('next_invoice_number', {
    p_user_id: user.id,
    p_prefix: 'INV-',
    p_peek: true,
  })

  if (error) {
    logError('invoices/next-number', 'RPC failed', { userId: user.id }, error)
    return NextResponse.json({ error: 'Failed to get next invoice number' }, { status: 500 })
  }

  return NextResponse.json({ invoiceNumber: data })
}
