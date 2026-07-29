/**
 * stockbook-webhook.ts — server-only
 *
 * Fires signed webhook events to StockBook so it can manage inventory
 * reservations when invoices are created or cancelled in Vortali.
 *
 * Never import this file from client components.
 */

import { createHmac } from 'crypto'

type LineItem = {
  product_id: string
  quantity: number
}

type WebhookPayload =
  | {
      type: 'invoice.created'
      data: {
        invoice_id: string
        user_id: string
        line_items: LineItem[]
      }
    }
  | {
      type: 'invoice.cancelled'
      data: {
        invoice_id: string
        user_id: string
      }
    }

type WebhookResult =
  | { ok: true }
  | { ok: false; status: number; body: string }

/**
 * Sign `body` with HMAC-SHA256 and return the `sha256=<hex>` header value.
 */
function sign(body: string, secret: string): string {
  const hex = createHmac('sha256', secret).update(body).digest('hex')
  return `sha256=${hex}`
}

/**
 * Fire a signed webhook event to StockBook.
 *
 * Returns `{ ok: true }` on 2xx, or `{ ok: false, status, body }` on error.
 * Never throws — callers should treat failure as non-fatal.
 */
export async function fireStockbookWebhook(payload: WebhookPayload): Promise<WebhookResult> {
  const secret = process.env.VORTALI_WEBHOOK_SECRET
  const url = process.env.STOCKBOOK_WEBHOOK_URL

  if (!secret || !url) {
    console.warn('[StockBook webhook] VORTALI_WEBHOOK_SECRET or STOCKBOOK_WEBHOOK_URL not set — skipping')
    return { ok: false, status: 0, body: 'env vars not configured' }
  }

  const body = JSON.stringify(payload)
  const signature = sign(body, secret)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vortali-signature': signature,
      },
      body,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[StockBook webhook] ${payload.type} failed — HTTP ${res.status}: ${text}`)
      return { ok: false, status: res.status, body: text }
    }

    console.log(`[StockBook webhook] ${payload.type} sent — invoice ${payload.data.invoice_id}`)
    return { ok: true }
  } catch (err) {
    console.error('[StockBook webhook] fetch error:', err)
    return { ok: false, status: 0, body: String(err) }
  }
}
