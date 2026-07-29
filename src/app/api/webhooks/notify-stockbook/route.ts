import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Client } from '@upstash/qstash'
import { logError } from '@/lib/logger'

/**
 * POST /api/webhooks/notify-stockbook
 *
 * Called by the invoice page after a new invoice is saved.
 * Fetches any line items that are linked to a StockBook product
 * (stockbook_product_id IS NOT NULL) and publishes an `invoice.created`
 * event to QStash so StockBook can reserve the inventory with delivery retries.
 *
 * If no line items are linked, this is a no-op (returns { ok: true, skipped: true }).
 * Publish failures are logged but never surface as errors to the caller —
 * invoice saving must succeed regardless of StockBook availability.
 */

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

    // Fetch line items that are linked to a StockBook product
    const { data: lineItems, error: fetchError } = await supabase
      .from('line_items')
      .select('stockbook_product_id, quantity')
      .eq('invoice_id', invoice_id)
      .not('stockbook_product_id', 'is', null)

    if (fetchError) {
      logError('webhooks/notify-stockbook', 'Failed to fetch line items', { invoice_id }, fetchError)
      return NextResponse.json({ error: 'Failed to fetch line items' }, { status: 500 })
    }

    if (!lineItems || lineItems.length === 0) {
      // No StockBook products in this invoice — nothing to do
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Sanitize quantities:
    // 1. Convert to Number  2. Reject non-finite  3. Round  4. Keep rounded qty > 0
    const sanitizedItems = lineItems
      .map((item) => ({
        product_id: item.stockbook_product_id as string,
        quantity: Math.round(Number(item.quantity)),
      }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0)

    if (sanitizedItems.length === 0) {
      // All items had zero/negative quantities — nothing valid to reserve
      return NextResponse.json({ ok: true, skipped: true })
    }

    const stockbookWebhookUrl = process.env.STOCKBOOK_WEBHOOK_URL
    if (!stockbookWebhookUrl) {
      logError(
        'webhooks/notify-stockbook',
        'STOCKBOOK_WEBHOOK_URL is not set — skipping',
        { invoice_id },
        new Error('STOCKBOOK_WEBHOOK_URL missing'),
      )
      return NextResponse.json({ ok: true, delivered: false })
    }

    try {
      await qstash.publishJSON({
        url: stockbookWebhookUrl,
        body: {
          type: 'invoice.created',
          data: { invoice_id, user_id, line_items: sanitizedItems },
        },
        retries: 3,
      })
    } catch (err) {
      // Log but return 200 — caller (handleSave) must not retry or fail
      logError('webhooks/notify-stockbook', 'QStash publish failed', { invoice_id }, err)
      return NextResponse.json({ ok: true, delivered: false })
    }

    return NextResponse.json({ ok: true, delivered: true })
  } catch (err) {
    logError('webhooks/notify-stockbook', 'Unhandled error', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
