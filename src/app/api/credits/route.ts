import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { CURRENCIES } from '@/lib/currencies'
import { requirePositiveNumber, optionalString, validateUUID } from '@/lib/api/validation'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = request.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  if (!validateUUID(clientId)) {
    return NextResponse.json({ error: 'clientId must be a valid UUID' }, { status: 400 })
  }

  const currency = request.nextUrl.searchParams.get('currency')

  if (currency && !CURRENCIES.some((c) => c.code === currency)) {
    return NextResponse.json({ error: 'Invalid currency code' }, { status: 400 })
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
    if (row.type === 'credit_added')    balance += Number(row.amount)
    else if (row.type === 'credit_applied')  balance -= Number(row.amount)
    else if (row.type === 'credit_refunded') balance -= Number(row.amount)
    else if (row.type === 'credit_adjusted') balance += Number(row.amount)
  }

  return NextResponse.json({ rows: data || [], balance })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { clientId, invoiceId, currency } = body as Record<string, unknown>

  // ── clientId — required UUID ──────────────────────────────────────────────
  if (!validateUUID(clientId)) {
    return NextResponse.json({ error: 'clientId must be a valid UUID' }, { status: 400 })
  }

  // ── amount — must be a JSON number, finite, positive ─────────────────────
  const amount = requirePositiveNumber(body.amount)
  if (amount === null) {
    return NextResponse.json(
      { error: 'Amount must be a positive number' },
      { status: 400 }
    )
  }

  // ── currency — optional string, falls back to NGN ─────────────────────────
  if (currency !== undefined && currency !== null && typeof currency !== 'string') {
    return NextResponse.json({ error: 'currency must be a string' }, { status: 400 })
  }
  const currencyToUse = optionalString(currency) || 'NGN'
  if (!CURRENCIES.some((c) => c.code === currencyToUse)) {
    return NextResponse.json({ error: 'Invalid currency code' }, { status: 400 })
  }

  // ── optional text fields ──────────────────────────────────────────────────
  const description     = optionalString(body.description)
  const referenceNumber = optionalString(body.referenceNumber)

  // ── invoiceId — optional UUID ─────────────────────────────────────────────
  if (invoiceId !== undefined && invoiceId !== null && !validateUUID(invoiceId)) {
    return NextResponse.json({ error: 'invoiceId must be a valid UUID' }, { status: 400 })
  }
  const resolvedInvoiceId = (typeof invoiceId === 'string' ? invoiceId : null)

  // Verify user owns the client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, currency')
    .eq('id', clientId as string)
    .eq('user_id', user.id)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  if (currencyToUse !== (client.currency || 'NGN')) {
    return NextResponse.json(
      { error: "Currency does not match the client's configured currency" },
      { status: 422 }
    )
  }

  // If invoiceId is supplied, verify the invoice belongs to this user and client
  if (resolvedInvoiceId) {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, client_id')
      .eq('id', resolvedInvoiceId)
      .eq('user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.client_id !== clientId) {
      return NextResponse.json(
        { error: 'Invoice does not belong to this client' },
        { status: 422 }
      )
    }
  }

  const { data, error } = await supabase
    .from('client_credits')
    .insert({
      user_id: user.id,
      client_id: clientId as string,
      amount,
      type: 'credit_added',
      description,
      reference_number: referenceNumber,
      invoice_id: resolvedInvoiceId,
      currency: currencyToUse,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
