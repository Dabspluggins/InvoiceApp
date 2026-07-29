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

    // Load estimate
    const { data: estimate, error: estError } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (estError || !estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    if (estimate.status !== 'approved' && estimate.status !== 'revised') {
      return NextResponse.json(
        { error: 'Only approved or revised estimates can be converted to invoices' },
        { status: 400 }
      )
    }

    // Load non-deleted line items
    const { data: estItems } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', estimate.id)
      .eq('deleted_by_client', false)
      .order('sort_order')

    // Try to get business info from the user's latest invoice
    const { data: latestInvoice } = await supabase
      .from('invoices')
      .select(
        'business_name, business_address, business_email, business_phone, logo_url, brand_color'
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Generate next invoice number
    const { data: latestInvNum } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    function nextInvoiceNumber(last: string | undefined): string {
      if (!last) return 'INV-0001'
      const match = last.match(/^(.*?)(\d+)$/)
      if (!match) return 'INV-0001'
      const prefix = match[1]
      const numStr = match[2]
      return prefix + String(parseInt(numStr, 10) + 1).padStart(numStr.length, '0')
    }

    const invoiceNumber = nextInvoiceNumber(latestInvNum?.invoice_number)
    const today = new Date().toISOString().split('T')[0]

    // Recalculate totals from non-deleted items, using client_proposed_price when available
    const activeItems = estItems || []
    if (activeItems.length === 0) {
      return NextResponse.json({ error: 'Estimate has no active line items to convert' }, { status: 400 })
    }

    const subtotal = activeItems.reduce(
      (sum, i) => sum + (i.client_proposed_price ?? i.unit_price) * i.quantity,
      0
    )
    const discountAmount =
      estimate.discount_type === 'percentage'
        ? subtotal * (estimate.discount_value / 100)
        : estimate.discount_value
    const taxable = Math.max(0, subtotal - discountAmount)
    const taxAmount = taxable * (estimate.tax_rate / 100)
    const total = taxable + taxAmount
    const invoiceDiscountType = estimate.discount_type === 'percentage' ? 'percent' : 'fixed'

    let clientCompany: string | null = null
    let clientAddress: string | null = null
    if (estimate.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('company, address')
        .eq('id', estimate.client_id)
        .eq('user_id', user.id)
        .maybeSingle()
      clientCompany = client?.company || null
      clientAddress = client?.address || null
    }

    // Create invoice
    const shareToken = randomBytes(32).toString('hex')

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        invoice_number: invoiceNumber,
        status: 'draft',
        issue_date: today,
        due_date: null,
        currency: estimate.currency,
        business_name: latestInvoice?.business_name || null,
        business_address: latestInvoice?.business_address || null,
        business_email: latestInvoice?.business_email || null,
        business_phone: latestInvoice?.business_phone || null,
        logo_url: latestInvoice?.logo_url || null,
        brand_color: latestInvoice?.brand_color || '#4F46E5',
        client_name: estimate.client_name,
        client_company: clientCompany,
        client_address: clientAddress,
        client_email: estimate.client_email,
        subtotal,
        discount_type: invoiceDiscountType,
        discount: estimate.discount_value || 0,
        discount_amount: discountAmount,
        tax_rate: estimate.tax_rate,
        tax_amount: taxAmount,
        total,
        notes: estimate.notes || null,
        share_token: shareToken,
      })
      .select('id')
      .single()

    if (invoiceError || !invoice) {
      logError('estimates/[id]/convert', 'Invoice creation failed', { userId: user.id, estimateId: id }, invoiceError)
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
    }

    // Create line items in invoices.line_items
    if (activeItems.length > 0) {
      const lineItemsPayload = activeItems.map((item, idx) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        rate: item.client_proposed_price ?? item.unit_price,
        amount: (item.client_proposed_price ?? item.unit_price) * item.quantity,
        sort_order: idx,
      }))
      const { error: liError } = await supabase.from('line_items').insert(lineItemsPayload)
      if (liError) {
        logError('estimates/[id]/convert', 'Line items insert failed', { userId: user.id, estimateId: id, invoiceId: invoice.id }, liError)
        // Clean up orphan invoice
        await supabase.from('invoices').delete().eq('id', invoice.id)
        return NextResponse.json({ error: 'Failed to create line items' }, { status: 500 })
      }
    }

    // Update estimate status to 'converted'
    await supabase
      .from('estimates')
      .update({ status: 'converted', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)

    // Log event
    await supabase.from('estimate_events').insert({
      estimate_id: id,
      event_type: 'converted',
      actor: 'owner',
      details: { invoice_id: invoice.id, invoice_number: invoiceNumber },
    })

    // Notify StockBook of invoice created from estimate via QStash.
    // Awaited so the enqueue reaches QStash before the response is sent.
    // Failures are non-fatal — invoice creation has already succeeded.
    await (async () => {
      try {
        const { data: sbItems } = await supabase
          .from('line_items')
          .select('stockbook_product_id, quantity')
          .eq('invoice_id', invoice.id)
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
              data: { invoice_id: invoice.id, user_id: user.id, line_items: sanitized },
            },
            retries: 3,
          })
        }
      } catch {
        // non-fatal
      }
    })()

    return NextResponse.json({ success: true, invoiceId: invoice.id })
  } catch (err) {
    logError('estimates/[id]/convert', 'Unhandled error', { estimateId: id }, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
