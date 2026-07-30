import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing, error: lookupError } = await supabase
    .from('clients')
    .select('id, portal_validity_days')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (lookupError && lookupError.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to load client' }, { status: 500 })
  }
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const validityDays = existing.portal_validity_days ?? 30
  const portal_token = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const portal_token_expires_at = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('clients')
    .update({ portal_token, portal_token_expires_at })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('portal_token, portal_token_expires_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
