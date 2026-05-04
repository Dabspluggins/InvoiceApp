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
    .select('id, user_id, total, credit_applied, status, invoice_number')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single()

  if (invError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
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

  // Compute current client credit balance
  const { data: allRows } = await supabase
    .from('client_credits')
    .select('amount, type')
    .eq('client_id', clientId)
    .eq('user_id', user.id)

  let balance = 0
  for (const row of (allRows || [])) {
    if (row.type === 'credit_added') balance += Number(row.amount)
    else if (row.type === 'credit_applied') balance -= Number(row.amount)
    else if (row.type === 'credit_refunded') balance -= Number(row.amount)
  }

  if (parsedAmount > balance) {
    return NextResponse.json(
      { error: `Insufficient credit balance (available: ${balance})` },
      { status: 422 }
    )
  }

  // Insert credit_applied row
  const { error: insertError } = await supabase
    .from('client_credits')
    .insert({
      user_id: user.id,
      client_id: clientId,
      amount: parsedAmount,
      type: 'credit_applied',
      invoice_id: invoiceId,
      description: `Credit applied to invoice ${invoice.invoice_number}`,
    })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Update invoice.credit_applied
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      credit_applied: Number(invoice.credit_applied || 0) + parsedAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const newBalance = balance - parsedAmount

  return NextResponse.json({ success: true, newBalance, creditApplied: parsedAmount })
}
