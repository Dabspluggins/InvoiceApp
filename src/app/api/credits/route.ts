import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { client_id, amount, type, reference_invoice_id, description } = body

  if (!client_id || !amount || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['credited', 'applied'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  // Verify user owns the client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', client_id)
    .eq('user_id', user.id)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('client_credits')
    .insert({
      user_id: user.id,
      client_id,
      amount,
      type,
      description: description || null,
      reference_invoice_id: reference_invoice_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
