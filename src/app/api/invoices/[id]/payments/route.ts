import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function recomputeInvoiceStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
  invoiceTotal: number,
  fallbackStatus: string
) {
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('invoice_id', invoiceId)

  const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const status = totalPaid >= invoiceTotal ? 'paid' : totalPaid > 0 ? 'partial' : fallbackStatus === 'draft' ? 'draft' : 'sent'

  const update: { status: string; paid_at?: string | null } = { status }
  if (status === 'paid') update.paid_at = new Date().toISOString()
  if (status !== 'paid') update.paid_at = null

  const { error } = await supabase
    .from('invoices')
    .update(update)
    .eq('id', invoiceId)

  if (error) throw error
  return { status, totalPaid }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const amount = Number(body.amount)
    const paidAt = String(body.paid_at || '').trim()
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
      return NextResponse.json({ error: 'Payment date is required' }, { status: 400 })
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, user_id, total, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        invoice_id: id,
        user_id: user.id,
        amount,
        paid_at: paidAt,
        note,
      })
      .select('*')
      .single()

    if (paymentError || !payment) {
      return NextResponse.json({ error: paymentError?.message || 'Failed to record payment' }, { status: 500 })
    }

    const { status, totalPaid } = await recomputeInvoiceStatus(
      supabase,
      id,
      Number(invoice.total || 0),
      invoice.status
    )

    return NextResponse.json({ payment, status, totalPaid }, { status: 201 })
  } catch (err) {
    console.error('invoice payment create error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const paymentId = typeof body.paymentId === 'string' ? body.paymentId : ''
    if (!paymentId) return NextResponse.json({ error: 'Payment id is required' }, { status: 400 })

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, user_id, total, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId)
      .eq('invoice_id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    const { status, totalPaid } = await recomputeInvoiceStatus(
      supabase,
      id,
      Number(invoice.total || 0),
      invoice.status
    )

    return NextResponse.json({ success: true, status, totalPaid })
  } catch (err) {
    console.error('invoice payment delete error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
