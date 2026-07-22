import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fireStockbookWebhook } from '@/lib/stockbook-webhook'
import { logError } from '@/lib/logger'

/**
 * POST /api/webhooks/notify-stockbook-update
 *
 * Called by the invoice page after an existing invoice is saved (edit path).
 * Reads the current line_items from DB (just re-inserted by handleSave), builds
 * the full new state, and fires a signed `invoice.updated` event to StockBook
 * so it can reconcile its inventory reservations.
 *
 * An empty line_items result is intentionally forwarded — it signals StockBook
 * to release all reservations for this invoice (all linked products were removed).
 *
 * A per-event UUID (event_key) is generated here and used by StockBook's
 * reconcile_invoice_items() as an operation-level idempotency key.
 *
 * Webhook failures are logged but never surface as errors to the caller —
 * invoice saving must succeed regardless of StockBook availability.
 *
 * (Temporary scaffolding — will be replaced by outbox + QStash in next sprint.)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { invoice_id, user_id } = body as { invoice_id?: string; user_id?: string }

    if (!invoice_id || !user_id) {
      return NextResponse.json({ error: 'invoice_id and user_id are required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify the caller is authenticated and owns this invoice
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the current StockBook-linked line items (just re-inserted by handleSave).
    // We query only items with a stockbook_product_id — unlinked items are irrelevant.
    const { data: lineItems, error: fetchError } = await supabase
      .from('line_items')
      .select('stockbook_product_id, quantity')
      .eq('invoice_id', invoice_id)
      .not('stockbook_product_id', 'is', null)

    if (fetchError) {
      logError(
        'webhooks/notify-stockbook-update',
        'Failed to fetch line items',
        { invoice_id },
        fetchError,
      )
      return NextResponse.json({ error: 'Failed to fetch line items' }, { status: 500 })
    }

    // Sanitize quantities. An empty array is valid — it tells StockBook to
    // release all reservations for this invoice.
    const sanitizedItems = (lineItems ?? [])
      .map((item) => ({
        product_id: item.stockbook_product_id as string,
        quantity: Math.round(Number(item.quantity)),
      }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0)

    const result = await fireStockbookWebhook({
      type: 'invoice.updated',
      data: {
        invoice_id,
        user_id,
        line_items: sanitizedItems,
        event_key: randomUUID(),
      },
    })

    if (!result.ok) {
      logError(
        'webhooks/notify-stockbook-update',
        'StockBook webhook delivery failed',
        { invoice_id, status: result.status },
        result.body,
      )
    }

    return NextResponse.json({ ok: true, delivered: result.ok })
  } catch (err) {
    logError('webhooks/notify-stockbook-update', 'Unhandled error', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
