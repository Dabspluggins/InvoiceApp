import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Client } from '@upstash/qstash'
import { logError } from '@/lib/logger'

/**
 * POST /api/webhooks/cancel-stockbook
 *
 * Called in two situations:
 *   1. BEFORE an invoice is deleted — releases stock and then the invoice is removed from DB.
 *   2. When a user explicitly cancels an invoice — releases stock, invoice stays in DB as 'cancelled'.
 *
 * Must run while line_items still exist in the DB (before CASCADE delete fires on deletes).
 *
 * Finds any line items in the given invoices that are linked to a StockBook
 * product (stockbook_product_id IS NOT NULL) and publishes an `invoice.cancelled`
 * event to QStash so it can release the inventory reservation with retries.
 *
 * Returns { ok: true, skipped: true } if no linked products are found.
 * Publish failures are logged but always return 200 — the calling action must proceed regardless.
 */

const qstash = new Client({ token: process.env.QSTASH_TOKEN! })

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

    const stockbookWebhookUrl = process.env.STOCKBOOK_WEBHOOK_URL
    if (!stockbookWebhookUrl) {
      logError(
        'webhooks/cancel-stockbook',
        'STOCKBOOK_WEBHOOK_URL is not set — endpoint disabled',
        { invoice_ids },
        new Error('STOCKBOOK_WEBHOOK_URL missing'),
      )
      return NextResponse.json({ error: 'Webhook endpoint not configured' }, { status: 503 })
    }

    // Publish invoice.cancelled to QStash for each linked invoice in parallel.
    // QStash handles delivery + retries; StockBook's release_invoice_items() is idempotent.
    const results = await Promise.allSettled(
      linkedInvoiceIds.map((invoice_id) =>
        qstash.publishJSON({
          url: stockbookWebhookUrl,
          body: {
            type: 'invoice.cancelled',
            data: { invoice_id, user_id },
          },
          retries: 3,
        }),
      ),
    )

    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      logError(
        'webhooks/cancel-stockbook',
        'Some cancellation publishes to QStash failed',
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
