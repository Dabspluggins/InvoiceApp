import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'
import type { EstimateTemplateItem } from '@/lib/types'

// GET /api/estimates/templates — list all templates for current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: templates } = await supabase
    .from('estimate_templates')
    .select('*, items:estimate_template_items(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ templates: templates || [] })
}

// POST /api/estimates/templates — create a new template from current estimate state
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, tax_rate, discount_type, discount_value, notes, terms,
          allow_negotiation, max_discount_pct, valid_days, items } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Template name is required' }, { status: 400 })

  const { data: template, error } = await supabase
    .from('estimate_templates')
    .insert({
      user_id: user.id,
      name: name.trim(),
      tax_rate,
      discount_type,
      discount_value,
      notes,
      terms,
      allow_negotiation,
      max_discount_pct,
      valid_days: valid_days || 7,
    })
    .select('id')
    .single()

  if (error || !template) return NextResponse.json({ error: 'Failed to save template' }, { status: 500 })

  if (items && items.length > 0) {
    await supabase.from('estimate_template_items').insert(
      items.map((item: EstimateTemplateItem, idx: number) => ({
        template_id: template.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        min_price: item.min_price || null,
        sort_order: idx,
      }))
    )
  }

  return NextResponse.json({ id: template.id })
}
