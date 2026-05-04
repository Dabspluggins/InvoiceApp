import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  // Verify user owns the client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('user_id', user.id)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('client_credits')
    .select('amount, type')
    .eq('client_id', clientId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let balance = 0
  for (const row of (data || [])) {
    if (row.type === 'credit_added') balance += Number(row.amount)
    else if (row.type === 'credit_applied') balance -= Number(row.amount)
    else if (row.type === 'credit_refunded') balance -= Number(row.amount)
  }

  return NextResponse.json({ clientId, balance })
}
