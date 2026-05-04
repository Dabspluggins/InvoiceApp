import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  const currency = request.nextUrl.searchParams.get('currency')

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

  let query = supabase
    .from('client_credits')
    .select('id, client_id, amount, type, description, reference_number, invoice_id, created_at')
    .eq('client_id', clientId)
    .eq('user_id', user.id)

  if (currency) query = query.eq('currency', currency)

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute running balance
  let balance = 0
  for (const row of (data || [])) {
    if (row.type === 'credit_added') balance += Number(row.amount)
    else if (row.type === 'credit_applied') balance -= Number(row.amount)
    else if (row.type === 'credit_refunded') balance -= Number(row.amount)
    else if (row.type === 'credit_adjusted') balance += Number(row.amount)
  }

  return NextResponse.json({ rows: data || [], balance })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { clientId, amount, description, referenceNumber, currency } = body

  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })

  const parsedAmount = Number(amount)
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
  }

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
    .insert({
      user_id: user.id,
      client_id: clientId,
      amount: parsedAmount,
      type: 'credit_added',
      description: description || null,
      reference_number: referenceNumber || null,
      currency: currency || 'NGN',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
