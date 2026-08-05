import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logger'
import { validateDateOnly, validateUUID } from '@/lib/api/validation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // ── amount — must be a JSON number, finite, positive ───────────────────
    const rawAmount = body.amount
    if (typeof rawAmount !== 'number' || !Number.isFinite(rawAmount) || rawAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be a positive number' },
        { status: 400 }
      )
    }
    const amount = rawAmount

    // ── paid_at — must be a valid YYYY-MM-DD calendar date ─────────────────
    // validateDateOnly rejects format errors AND phantom dates like 2026-02-31.
    if (!validateDateOnly(body.paid_at)) {
      return NextResponse.json(
        { error: 'Payment date must be a valid YYYY-MM-DD date' },
        { status: 400 }
      )
    }
    const paidAt = body.paid_at as string

    // ── note — optional string ──────────────────────────────────────────────
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, user_id, total, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot record a payment on a cancelled invoice' },
        { status: 409 }
      )
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({ invoice_id: id, user_id: user.id, amount, paid_at: paidAt, note })
      .select('*')
      .single()

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: paymentError?.message || 'Failed to record payment' },
        { status: 500 }
      )
    }

    const { data: recomputeData, error: recomputeError } = await supabase
      .rpc('recompute_invoice_status', { p_invoice_id: id })
      .single()

    if (recomputeError || !recomputeData) {
      return NextResponse.json({ error: 'Failed to update invoice status' }, { status: 500 })
    }

    const { new_status: status, total_paid: totalPaid } = recomputeData as {
      new_status: string
      total_paid: number
    }

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

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // ── paymentId — must be a valid UUID string ─────────────────────────────
    if (!validateUUID(body.paymentId)) {
      return NextResponse.json({ error: 'paymentId must be a valid UUID' }, { status: 400 })
    }
    const paymentId = body.paymentId as string

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, user_id, total, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot delete a payment on a cancelled invoice' },
        { status: 409 }
      )
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

    const { new_status: status, total_paid: totalPaid } = recomputeData as {
      new_status: string
      total_paid: number
    }

    return NextResponse.json({ success: true, status, totalPaid })
  } catch (err) {
    logError('invoices/[id]/payments', 'Payment delete failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
