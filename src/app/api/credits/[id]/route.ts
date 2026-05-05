import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the credit row, scoped to this user
  const { data: credit, error: fetchError } = await supabase
    .from('client_credits')
    .select('id, client_id, amount, type, currency')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !credit) {
    return NextResponse.json({ error: 'Credit not found' }, { status: 404 })
  }

  if (credit.type !== 'credit_added') {
    return NextResponse.json({ error: 'Only credit_added entries can be reversed' }, { status: 400 })
  }

  const creditCurrency = credit.currency || 'NGN'

  // Guard: reversing this entry must not push the client balance negative.
  const { data: allRows } = await supabase
    .from('client_credits')
    .select('amount, type')
    .eq('client_id', credit.client_id)
    .eq('user_id', user.id)
    .eq('currency', creditCurrency)

  let balance = 0
  for (const row of (allRows || [])) {
    if (row.type === 'credit_added') balance += Number(row.amount)
    else if (row.type === 'credit_applied') balance -= Number(row.amount)
    else if (row.type === 'credit_refunded') balance -= Number(row.amount)
    else if (row.type === 'credit_adjusted') balance += Number(row.amount)
  }

  const balanceAfterReversal = balance - Number(credit.amount)
  if (balanceAfterReversal < 0) {
    return NextResponse.json(
      { error: 'Cannot reverse this credit — it would make the client balance negative' },
      { status: 422 }
    )
  }

  // Insert a reversal entry instead of hard-deleting to preserve the audit trail.
  const { error: insertError } = await supabase
    .from('client_credits')
    .insert({
      user_id: user.id,
      client_id: credit.client_id,
      amount: -Number(credit.amount),
      type: 'credit_adjusted',
      description: `Reversal of deposit #${id}`,
      currency: creditCurrency,
    })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ success: true, newBalance: balanceAfterReversal })
}
