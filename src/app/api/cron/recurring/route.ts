import type { NextRequest } from 'next/server'
import { Client } from '@upstash/qstash'
import { createAdminClient } from '@/lib/supabase/admin'
import { logError } from '@/lib/logger'

const qstash = new Client({ token: process.env.QSTASH_TOKEN! })

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Fetch IDs of all due recurring parent invoices.
  // The generate_recurring_invoice RPC re-validates each one under a row lock,
  // so this read does not need to be perfectly consistent.
  const { data: dueInvoices, error: fetchError } = await supabase
    .from('invoices')
    .select('id, user_id')
    .eq('is_recurring', true)
    .neq('status', 'cancelled')
    .lte('recurring_next_date', today)

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 })
  }

  if (!dueInvoices || dueInvoices.length === 0) {
    return Response.json({ generated: 0, invoices: [] })
  }

  const generated: string[] = []
  let skipped = 0
  let failed = 0
  const failedParentIds: string[] = []

  for (const inv of dueInvoices) {
    // generate_recurring_invoice is fully atomic:
    // - Locks the parent row (FOR UPDATE)
    // - Finds or creates the child by generation key (idempotent retry)
    // - Allocates invoice number, copies line items, advances parent next date
    // - Returns (child_invoice_id, already_generated)
    const { data: result, error: rpcError } = await supabase
      .rpc('generate_recurring_invoice', {
        p_parent_id: inv.id,
        p_today: today,
      })
      .single()

    if (rpcError || !result) {
      logError(
        'cron/recurring',
        'generate_recurring_invoice RPC failed',
        { parentId: inv.id },
        rpcError
      )
      failed++
      failedParentIds.push(inv.id)
      continue
    }

    const { child_invoice_id: childId, already_generated: alreadyGenerated } =
      result as { child_invoice_id: string | null; already_generated: boolean }

    // childId is null when the parent is not yet due (race guard inside the RPC).
    if (!childId) {
      skipped++
      continue
    }

    if (alreadyGenerated) {
      // Idempotent retry — child existed, parent was advanced. Not a new generation.
      skipped++
    } else {
      generated.push(childId)

      // Notify StockBook for invoices created in this run (not idempotent retries —
      // a prior run already notified for those).
      const stockbookWebhookUrl = process.env.STOCKBOOK_WEBHOOK_URL
      if (stockbookWebhookUrl) {
        const { data: sbItems } = await supabase
          .from('line_items')
          .select('stockbook_product_id, quantity')
          .eq('invoice_id', childId)
          .not('stockbook_product_id', 'is', null)

        if (sbItems && sbItems.length > 0) {
          const sanitized = sbItems
            .map((item) => ({
              product_id: item.stockbook_product_id as string,
              quantity: Math.round(Number(item.quantity)),
            }))
            .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0)

          if (sanitized.length > 0) {
            await qstash
              .publishJSON({
                url: stockbookWebhookUrl,
                body: {
                  type: 'invoice.created',
                  data: { invoice_id: childId, user_id: inv.user_id, line_items: sanitized },
                },
                retries: 3,
                deduplicationId: `invoice.created:${childId}`,
              })
              .catch(() => {})
          }
        }
      }
    }
  }

  return Response.json({
    generated: generated.length,
    skipped,
    failed,
    ...(failedParentIds.length > 0 ? { failedParentIds } : {}),
    invoices: generated,
  })
}
