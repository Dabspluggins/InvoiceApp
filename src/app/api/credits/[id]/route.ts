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
    .select('id, client_id, amount, type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !credit) {
    return NextResponse.json({ error: 'Credit not found' }, { status: 404 })
  }

  if (credit.type !== 'credit_added') {
    return NextResponse.json({ error: 'Only credit_added entries can be deleted' }, { status: 400 })
  }

  // Guard: deleting this entry must not push the client balance negative.
  const { data: allRows } = await supabase
    .from('client_credits')
    .select('amount, type')
    .eq('client_id', credit.client_id)
    .eq('user_id', user.id)

  let balance = 0
  for (const row of (allRows || [])) {
    if (row.type === 'credit_added') balance += Number(row.amount)
    else if (row.type === 'credit_applied') balance -= Number(row.amount)
    else if (row.type === 'credit_refunded') balance -= Number(row.amount)
  }

  const balanceAfterDelete = balance - Number(credit.amount)
  if (balanceAfterDelete < 0) {
    return NextResponse.json(
      { error: 'Cannot delete this credit — it would make the client balance negative' },
      { status: 422 }
    )
  }

  const { error: deleteError } = await supabase
    .from('client_credits')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ success: true, newBalance: balanceAfterDelete })
}
