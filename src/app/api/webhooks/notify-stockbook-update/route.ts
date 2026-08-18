import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Client } from '@upstash/qstash'
import { logError } from '@/lib/logger'

/**
 * POST /api/webhooks/notify-stockbook-update
 *
 * Called by the invoice page after an existing invoice is saved (edit path).
 * Reads the current line_items from DB (just re-inserted by handleSave), builds
 * the full new state, and publishes an `invoice.updated` event to QStash.
 *
 * QStash delivers the event to StockBook with automatic retries (up to 3).
 * A stable event_key UUID is baked into the message body so every retry
 * carries the same key — StockBook's reconcile_invoice_items() uses it for
 * operation-level idempotency via the webhook_events table.
 *
 * An empty line_items result is intentionally forwarded — it signals StockBook
 * to release all reservations for this invoice (all linked products removed).
 *
 * Publish failures are logged but never surface as errors to the caller —
 * invoice saving must succeed regardless of StockBook availability.
 */

// QStash client — initialised once per cold start.
const qstash = new Client({ token: process.env.QSTASH_TOKEN! })

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

    // Verify the invoice belongs to the authenticated user before touching anything.
    // Without this check an authenticated caller could supply an arbitrary invoice_id
    // (IDOR) and emit a release-all event on StockBook for an invoice they don't own.
    const { data: invoiceRow, error: invoiceError } = await supabase
      .from('invoices')
      .select('id')
      .eq('id', invoice_id)
      .eq('user_id', user_id)
      .single()

    if (invoiceError || !invoiceRow) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
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

    const stockbookWebhookUrl = process.env.STOCKBOOK_WEBHOOK_URL
    if (!stockbookWebhookUrl) {
      logError(
        'webhooks/notify-stockbook-update',
        'STOCKBOOK_WEBHOOK_URL is not set — endpoint disabled',
        { invoice_id },
        new Error('STOCKBOOK_WEBHOOK_URL missing'),
      )
      return NextResponse.json({ error: 'Webhook endpoint not configured' }, { status: 503 })
    }

    // Publish to QStash. The event_key UUID is baked into the body here so
    // all retries carry the same key — StockBook's reconcile_invoice_items()
    // uses it for operation-level idempotency via the webhook_events table.
    //
    // No deduplicationId here: invoice.updated can fire legitimately many
    // times (each save is a distinct edit). Duplicate-delivery protection is
    // already handled by StockBook's event_key-based idempotency guard.
    // A time-bucketed key would silently drop legitimate edits that fall in
    // the same window; a static key would block all future updates.
    const event_key = randomUUID()

    const result = await qstash.publishJSON({
      url: stockbookWebhookUrl,
      body: {
        type: 'invoice.updated',
        data: {
          invoice_id,
          user_id,
          line_items: sanitizedItems,
          event_key,
        },
      },
      retries: 3,
    })

    return NextResponse.json({ ok: true, messageId: result.messageId })
  } catch (err) {
    logError('webhooks/notify-stockbook-update', 'Unhandled error', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
