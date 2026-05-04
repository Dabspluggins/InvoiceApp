import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { invoiceId, clientId, creditAmount } = body

  if (!invoiceId || !clientId) {
    return NextResponse.json({ error: 'invoiceId and clientId are required' }, { status: 400 })
  }

  const parsedAmount = Number(creditAmount)
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: 'creditAmount must be greater than zero' }, { status: 400 })
  }

  // Verify invoice belongs to user
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('id, user_id, total, credit_applied, status, invoice_number, client_id, currency')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (invError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Verify the invoice belongs to the specified client (when client_id is set on the invoice)
  if (invoice.client_id !== null && invoice.client_id !== clientId) {
    return NextResponse.json({ error: 'Invoice does not belong to this client' }, { status: 400 })
  }

  if (invoice.status === 'paid') {
    return NextResponse.json({ error: 'Cannot apply credit to a fully paid invoice' }, { status: 422 })
  }

  const invoiceTotal = Number(invoice.total || 0)
  if (parsedAmount > invoiceTotal) {
    return NextResponse.json({ error: 'Credit amount cannot exceed the invoice total' }, { status: 422 })
  }

  // Verify client belongs to user
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('user_id', user.id)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const currency = invoice.currency || 'NGN'

  // Atomically check balance, insert ledger entry, and update invoice via RPC.
  // The RPC uses SELECT FOR UPDATE to prevent concurrent overdraw.
  const { data: newBalance, error: rpcError } = await supabase.rpc('apply_client_credit', {
    p_client_id:  clientId,
    p_invoice_id: invoiceId,
    p_amount:     parsedAmount,
    p_user_id:    user.id,
    p_currency:   currency,
  })

  if (rpcError) {
    const isInsufficient = rpcError.message?.includes('Insufficient credit balance')
    return NextResponse.json(
      { error: isInsufficient ? rpcError.message : 'Failed to apply credit' },
      { status: isInsufficient ? 422 : 500 }
    )
  }

  return NextResponse.json({ success: true, newBalance, creditApplied: parsedAmount })
}
