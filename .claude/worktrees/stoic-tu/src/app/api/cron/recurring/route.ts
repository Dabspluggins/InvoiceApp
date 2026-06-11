import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

function nextRecurringDate(fromDate: string, frequency: string): string {
  const d = new Date(fromDate)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'quarterly') d.setMonth(d.getMonth() + 3)
  return d.toISOString().split('T')[0]
}

function shiftDate(dateStr: string | null, frequency: string): string | null {
  if (!dateStr) return null
  return nextRecurringDate(dateStr, frequency)
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: 'Missing Supabase credentials' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const today = new Date().toISOString().split('T')[0]

  const { data: dueInvoices, error: fetchError } = await supabase
    .from('invoices')
    .select('*')
    .eq('is_recurring', true)
    .lte('recurring_next_date', today)

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 })
  }

  if (!dueInvoices || dueInvoices.length === 0) {
    return Response.json({ generated: 0, invoices: [] })
  }

  const generated: string[] = []

  for (const inv of dueInvoices) {
    const freq: string = inv.recurring_frequency

    // Determine new invoice number by incrementing
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', inv.user_id)

    const newNumber = `INV-${String((count ?? 0) + 1).padStart(4, '0')}`

    const newIssueDate = today
    const newDueDate = shiftDate(inv.due_date, freq)
    const newNextDate = newDueDate ? nextRecurringDate(newDueDate, freq) : null

    // Create new invoice
    const { data: newInv, error: insertError } = await supabase
      .from('invoices')
      .insert({
        user_id: inv.user_id,
        invoice_number: newNumber,
        status: 'draft',
        issue_date: newIssueDate,
        due_date: newDueDate,
        currency: inv.currency,
        business_name: inv.business_name,
        business_address: inv.business_address,
        business_email: inv.business_email,
        business_phone: inv.business_phone,
        logo_url: inv.logo_url,
        client_name: inv.client_name,
        client_company: inv.client_company,
        client_address: inv.client_address,
        client_email: inv.client_email,
        subtotal: inv.subtotal,
        tax_rate: inv.tax_rate,
        tax_amount: inv.tax_amount,
        total: inv.total,
        notes: inv.notes,
        brand_color: inv.brand_color,
        is_recurring: false,
        recurring_frequency: null,
        recurring_next_date: null,
        recurring_parent_id: inv.id,
      })
      .select('id')
      .single()

    if (insertError || !newInv) continue

    // Copy line items
    const { data: lineItems } = await supabase
      .from('line_items')
      .select('description, quantity, rate, amount, sort_order')
      .eq('invoice_id', inv.id)

    if (lineItems && lineItems.length > 0) {
      await supabase.from('line_items').insert(
        lineItems.map((item) => ({ ...item, invoice_id: newInv.id }))
      )
    }

    // Advance parent's next date
    await supabase
      .from('invoices')
      .update({ recurring_next_date: newNextDate })
      .eq('id', inv.id)

    generated.push(newInv.id)
  }

  return Response.json({ generated: generated.length, invoices: generated })
}
