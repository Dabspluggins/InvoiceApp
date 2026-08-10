import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logger'
import { Client } from '@upstash/qstash'

const qstash = new Client({ token: process.env.QSTASH_TOKEN! })

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Generate the share token here rather than inside the RPC so we avoid
    // adding the pgcrypto/extensions schema to the RPC search_path.
    const shareToken = randomBytes(32).toString('hex')

    // convert_estimate_to_invoice is fully atomic:
    // - Locks the estimate row (FOR UPDATE)
    // - Returns early if already converted (idempotent)
    // - Validates status and active line items
    // - Allocates invoice number, inserts invoice + line items, marks estimate converted
    // - Logs the conversion event
    const { data: result, error: convError } = await supabase
      .rpc('convert_estimate_to_invoice', {
        p_estimate_id: id,
        p_user_id: user.id,
        p_share_token: shareToken,
      })
      .single()

    if (convError) {
      const msg = convError.message
      if (msg.includes('estimate_not_found'))
        return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
      if (msg.includes('invalid_estimate_status'))
        return NextResponse.json(
          { error: 'Only approved or revised estimates can be converted to invoices' },
          { status: 400 }
        )
      if (msg.includes('no_active_line_items'))
        return NextResponse.json(
          { error: 'Estimate has no active line items to convert' },
          { status: 400 }
        )
      logError('estimates/[id]/convert', 'convert_estimate_to_invoice RPC failed', { userId: user.id, estimateId: id }, convError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const { invoice_id: invoiceId, already_converted: alreadyConverted } = result as {
      invoice_id: string
      invoice_number: string
      already_converted: boolean
    }

    // Notify StockBook only for invoices created in this call.
    // already_converted = true means a prior call already notified.
    if (!alreadyConverted) {
      await (async () => {
        try {
          const { data: sbItems } = await supabase
            .from('line_items')
            .select('stockbook_product_id, quantity')
            .eq('invoice_id', invoiceId)
            .not('stockbook_product_id', 'is', null)

          if (!sbItems || sbItems.length === 0) return

          const sanitized = sbItems
            .map((item) => ({
              product_id: item.stockbook_product_id as string,
              quantity: Math.round(Number(item.quantity)),
            }))
            .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0)

          if (sanitized.length === 0) return

          const stockbookWebhookUrl = process.env.STOCKBOOK_WEBHOOK_URL
          if (stockbookWebhookUrl) {
            await qstash.publishJSON({
              url: stockbookWebhookUrl,
              body: {
                type: 'invoice.created',
                data: { invoice_id: invoiceId, user_id: user.id, line_items: sanitized },
              },
              retries: 3,
              deduplicationId: `invoice.created:${invoiceId}`,
            })
          }
        } catch {
          // non-fatal — invoice creation already succeeded
        }
      })()
    }

    return NextResponse.json({ success: true, invoiceId, alreadyConverted })
  } catch (err) {
    logError('estimates/[id]/convert', 'Unhandled error', { estimateId: id }, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
