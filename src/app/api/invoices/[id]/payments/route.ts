import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logger'

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

    const { data: recomputeData, error: recomputeError } = await supabase
      .rpc('recompute_invoice_status', { p_invoice_id: id })
      .single()

    if (recomputeError || !recomputeData) {
      return NextResponse.json({ error: 'Failed to update invoice status' }, { status: 500 })
    }

    const { new_status: status, total_paid: totalPaid } = recomputeData

    return NextResponse.json({ payment, status, totalPaid }, { status: 201 })
  } catch (err) {
    logError('invoices/[id]/payments', 'Payment create failed', {}, err)
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

    const { data: recomputeData, error: recomputeError } = await supabase
      .rpc('recompute_invoice_status', { p_invoice_id: id })
      .single()

    if (recomputeError || !recomputeData) {
      return NextResponse.json({ error: 'Failed to update invoice status' }, { status: 500 })
    }

    const { new_status: status, total_paid: totalPaid } = recomputeData

    return NextResponse.json({ success: true, status, totalPaid })
  } catch (err) {
    logError('invoices/[id]/payments', 'Payment delete failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
