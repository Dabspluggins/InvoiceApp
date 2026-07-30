import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fireStockbookWebhook } from '@/lib/stockbook-webhook'
import { logError } from '@/lib/logger'

/**
 * POST /api/webhooks/cancel-stockbook
 *
 * Called BEFORE an invoice (or batch of invoices) is deleted from Vortali.
 * Must run while line_items still exist in the DB (before CASCADE delete fires).
 *
 * Finds any line items in the given invoices that are linked to a StockBook
 * product (stockbook_product_id IS NOT NULL) and fires a signed `invoice.cancelled`
 * event to StockBook so it can release the inventory reservation.
 *
 * Returns { ok: true, skipped: true } if no linked products are found.
 * Webhook failures are logged but always return 200 — delete must proceed regardless.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { invoice_ids, user_id } = body as { invoice_ids?: string[]; user_id?: string }

    if (!invoice_ids?.length || !user_id) {
      return NextResponse.json(
        { error: 'invoice_ids (non-empty array) and user_id are required' },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find which of the invoices actually have StockBook-linked line items.
    // Must run BEFORE the invoices are deleted so line_items still exist.
    const { data: lineItems, error: fetchError } = await supabase
      .from('line_items')
      .select('invoice_id')
      .in('invoice_id', invoice_ids)
      .not('stockbook_product_id', 'is', null)

    if (fetchError) {
      logError(
        'webhooks/cancel-stockbook',
        'Failed to fetch line items',
        { invoice_ids },
        fetchError,
      )
      return NextResponse.json({ error: 'Failed to fetch line items' }, { status: 500 })
    }

    const linkedInvoiceIds = [
      ...new Set((lineItems || []).map((li) => li.invoice_id as string)),
    ]

    if (linkedInvoiceIds.length === 0) {
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Fire invoice.cancelled for each linked invoice in parallel.
    const results = await Promise.all(
      linkedInvoiceIds.map((invoice_id) =>
        fireStockbookWebhook({
          type: 'invoice.cancelled',
          data: { invoice_id, user_id },
        }),
      ),
    )

    const failed = results.filter((r) => !r.ok)
    if (failed.length > 0) {
      logError(
        'webhooks/cancel-stockbook',
        'Some cancellation webhooks failed',
        { linkedInvoiceIds, failCount: failed.length },
        failed,
      )
    }

    return NextResponse.json({
      ok: true,
      cancelled: linkedInvoiceIds.length,
      failed: failed.length,
    })
  } catch (err) {
    logError('webhooks/cancel-stockbook', 'Unhandled error', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
