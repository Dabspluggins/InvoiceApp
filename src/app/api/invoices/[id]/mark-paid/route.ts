import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the invoice to verify ownership
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, status, user_id')
      .eq('id', id)
      .single()

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 409 })
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    logAudit({
      userId: user.id,
      action: 'invoice.marked_paid',
      entityType: 'invoice',
      entityId: id,
    }).catch(console.error)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('mark-paid error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
