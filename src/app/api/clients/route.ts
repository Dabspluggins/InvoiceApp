import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import { requireString, optionalString } from '@/lib/api/validation'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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

  // ── name — required string ────────────────────────────────────────────────
  const name = requireString(body.name)
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // ── optional text fields ──────────────────────────────────────────────────
  const company = optionalString(body.company)
  const email   = optionalString(body.email)
  const phone   = optionalString(body.phone)
  const address = optionalString(body.address)

  // ── currency — optional string, falls back to NGN ────────────────────────
  const rawCurrency = body.currency
  if (rawCurrency !== undefined && rawCurrency !== null && typeof rawCurrency !== 'string') {
    return NextResponse.json({ error: 'currency must be a string' }, { status: 400 })
  }
  const currency = optionalString(rawCurrency) || 'NGN'

  // ── portal_validity_days — must be one of the allowed values ──────────────
  const VALID_DAYS = [30, 60, 90, 180]
  const rawValidity = body.portal_validity_days
  const validityDays = VALID_DAYS.includes(Number(rawValidity)) ? Number(rawValidity) : 30

  const portal_token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const portal_token_expires_at = new Date(
    Date.now() + validityDays * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data, error } = await supabase
    .from('clients')
    .insert({
      user_id: user.id,
      name,
      company,
      email,
      phone,
      address,
      portal_token,
      portal_token_expires_at,
      currency,
      portal_validity_days: validityDays,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
