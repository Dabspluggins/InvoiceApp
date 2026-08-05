import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/logger'
import { validateDateOnly } from '@/lib/api/validation'
import { INVOICE_STATUSES, type InvoiceStatus } from '@/lib/types'

const VALID_FREQUENCIES  = ['weekly', 'monthly', 'quarterly'] as const
const VALID_DISCOUNT_TYPES = ['fixed', 'percent'] as const
// UUID v4 format used by Supabase for client_id
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Optional text fields with no structural constraint beyond "must be a string".
// Validated as a group; extracted individually below.
// NOTE: payment_details is excluded here — it is JSONB (object/null), not text.
const OPTIONAL_TEXT_FIELDS = [
  'business_name', 'business_address', 'business_email', 'business_phone',
  'logo_url',
  'client_name', 'client_company', 'client_address', 'client_email',
  'notes', 'brand_color', 'template', 'language',
] as const

/**
 * POST /api/invoices
 *
 * Server-side invoice creation. Every client-supplied field is type-checked and
 * normalized before the invoice number sequence is allocated. The payload passed
 * to the database insert contains only named, typed local variables — never raw
 * body casts — so server-owned columns cannot be set by the caller.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // ─── Normalize and validate every field before sequence allocation ─────────
  // Sequence allocation is irreversible. All type checks and ownership checks
  // run here so bad input never burns a slot in invoice_sequences.

  // ── Dates ──────────────────────────────────────────────────────────────────
  const issueDate = body.issue_date
  if (typeof issueDate !== 'string' || !validateDateOnly(issueDate)) {
    return NextResponse.json(
      { error: 'issue_date is required and must be a valid YYYY-MM-DD date' },
      { status: 400 }
    )
  }

  const rawDueDate = body.due_date
  if (rawDueDate !== undefined && rawDueDate !== null) {
    if (typeof rawDueDate !== 'string' || !validateDateOnly(rawDueDate)) {
      return NextResponse.json(
        { error: 'due_date must be a valid YYYY-MM-DD date' },
        { status: 400 }
      )
    }
  }
  const dueDate = (rawDueDate as string | null | undefined) ?? null

  // ── Currency ───────────────────────────────────────────────────────────────
  const rawCurrency = body.currency
  if (typeof rawCurrency !== 'string' || !/^[A-Z]{3}$/.test(rawCurrency)) {
    return NextResponse.json(
      { error: 'currency is required and must be a 3-letter ISO code (e.g. USD)' },
      { status: 400 }
    )
  }
  const currency = rawCurrency

  // ── Status ─────────────────────────────────────────────────────────────────
  // Sourced from the shared INVOICE_STATUSES constant so route validation and
  // the InvoiceStatus type cannot drift independently.
  const rawStatus: unknown = body.status ?? 'draft'
  if (typeof rawStatus !== 'string' || !INVOICE_STATUSES.includes(rawStatus as InvoiceStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${INVOICE_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }
  const status = rawStatus as InvoiceStatus

  // ── discount_type ──────────────────────────────────────────────────────────
  const rawDiscountType: unknown = body.discount_type ?? 'fixed'
  if (
    typeof rawDiscountType !== 'string' ||
    !VALID_DISCOUNT_TYPES.includes(rawDiscountType as (typeof VALID_DISCOUNT_TYPES)[number])
  ) {
    return NextResponse.json(
      { error: 'discount_type must be fixed or percent' },
      { status: 400 }
    )
  }
  const discountType = rawDiscountType as 'fixed' | 'percent'

  // ── Optional text fields ───────────────────────────────────────────────────
  // Validate as a group: if present, must be a string. Extract individually below.
  for (const field of OPTIONAL_TEXT_FIELDS) {
    const val = body[field]
    if (val !== undefined && val !== null && typeof val !== 'string') {
      return NextResponse.json({ error: `${field} must be a string` }, { status: 400 })
    }
  }
  const businessName    = (body.business_name    as string | null | undefined) ?? null
  const businessAddress = (body.business_address as string | null | undefined) ?? null
  const businessEmail   = (body.business_email   as string | null | undefined) ?? null
  const businessPhone   = (body.business_phone   as string | null | undefined) ?? null
  const logoUrl         = (body.logo_url         as string | null | undefined) ?? null
  const clientName      = (body.client_name      as string | null | undefined) ?? null
  const clientCompany   = (body.client_company   as string | null | undefined) ?? null
  const clientAddress   = (body.client_address   as string | null | undefined) ?? null
  const clientEmail     = (body.client_email     as string | null | undefined) ?? null
  const notes           = (body.notes            as string | null | undefined) ?? null
  const brandColor      = (body.brand_color      as string | null | undefined) ?? '#4F46E5'
  const template        = (body.template         as string | null | undefined) ?? 'classic'
  const language        = (body.language         as string | null | undefined) ?? 'en'

  // ── payment_details ────────────────────────────────────────────────────────
  // Stored as JSONB — must be a plain object or null, not a string or array.
  const rawPaymentDetails = body.payment_details
  if (rawPaymentDetails !== undefined && rawPaymentDetails !== null) {
    if (typeof rawPaymentDetails !== 'object' || Array.isArray(rawPaymentDetails)) {
      return NextResponse.json(
        { error: 'payment_details must be a JSON object' },
        { status: 400 }
      )
    }
  }
  const paymentDetails = (rawPaymentDetails as object | null | undefined) ?? null

  // ── client_id ──────────────────────────────────────────────────────────────
  const rawClientId = body.client_id
  if (rawClientId !== undefined && rawClientId !== null) {
    if (typeof rawClientId !== 'string' || !UUID_RE.test(rawClientId)) {
      return NextResponse.json({ error: 'client_id must be a valid UUID string' }, { status: 400 })
    }
  }
  const clientId = (rawClientId as string | null | undefined) ?? null

  // ── Numeric fields ─────────────────────────────────────────────────────────
  // Require actual JSON numbers — not numeric strings, not booleans.
  const numericFields = [
    'subtotal', 'discount', 'discount_amount', 'tax_rate', 'tax_amount', 'total',
  ] as const
  for (const field of numericFields) {
    const val = body[field]
    if (val != null && (typeof val !== 'number' || !Number.isFinite(val))) {
      return NextResponse.json({ error: `${field} must be a finite number` }, { status: 400 })
    }
  }
  const subtotal       = (body.subtotal       as number | undefined) ?? 0
  const discount       = (body.discount       as number | undefined) ?? 0
  const discountAmount = (body.discount_amount as number | undefined) ?? 0
  const taxRate        = (body.tax_rate        as number | undefined) ?? 0
  const taxAmount      = (body.tax_amount      as number | undefined) ?? 0
  const total          = (body.total           as number | undefined) ?? 0

  // ── is_recurring ───────────────────────────────────────────────────────────
  const rawIsRecurring: unknown = body.is_recurring ?? false
  if (typeof rawIsRecurring !== 'boolean') {
    return NextResponse.json({ error: 'is_recurring must be a boolean' }, { status: 400 })
  }
  const isRecurring = rawIsRecurring

  let recurringFrequency: string | null = null
  let recurringNextDate: string | null = null
  if (isRecurring) {
    const rawFreq: unknown = body.recurring_frequency
    if (
      typeof rawFreq !== 'string' ||
      !VALID_FREQUENCIES.includes(rawFreq as (typeof VALID_FREQUENCIES)[number])
    ) {
      return NextResponse.json(
        { error: 'recurring_frequency must be weekly, monthly, or quarterly when is_recurring is true' },
        { status: 400 }
      )
    }
    recurringFrequency = rawFreq

    const rawNextDate = body.recurring_next_date
    if (rawNextDate !== undefined && rawNextDate !== null) {
      if (typeof rawNextDate !== 'string' || !validateDateOnly(rawNextDate)) {
        return NextResponse.json(
          { error: 'recurring_next_date must be a valid YYYY-MM-DD date' },
          { status: 400 }
        )
      }
      recurringNextDate = rawNextDate
    }
  }

  // ── client_id ownership ────────────────────────────────────────────────────
  if (clientId) {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!clientRow) {
      return NextResponse.json({ error: 'Client not found' }, { status: 422 })
    }
  }

  // ── line_items — optional array, validated before sequence allocation ───────
  // Each item: description (string), quantity/rate/amount (finite numbers >= 0),
  // stockbook_product_id (UUID or null).
  const rawLineItems = body.line_items
  type ValidatedLineItem = {
    description: string
    quantity: number
    rate: number
    amount: number
    sort_order: number
    stockbook_product_id: string | null
  }
  const lineItems: ValidatedLineItem[] = []
  if (rawLineItems !== undefined && rawLineItems !== null) {
    if (!Array.isArray(rawLineItems)) {
      return NextResponse.json({ error: 'line_items must be an array' }, { status: 400 })
    }
    for (let i = 0; i < rawLineItems.length; i++) {
      const item = rawLineItems[i] as Record<string, unknown>
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return NextResponse.json({ error: `line_items[${i}] must be an object` }, { status: 400 })
      }
      const desc = item.description
      if (typeof desc !== 'string') {
        return NextResponse.json({ error: `line_items[${i}].description must be a string` }, { status: 400 })
      }

      const quantity = item.quantity
      if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) {
        return NextResponse.json(
          { error: `line_items[${i}].quantity must be a finite non-negative number` },
          { status: 400 }
        )
      }

      const rate = item.rate
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) {
        return NextResponse.json(
          { error: `line_items[${i}].rate must be a finite non-negative number` },
          { status: 400 }
        )
      }

      const amount = item.amount
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
        return NextResponse.json(
          { error: `line_items[${i}].amount must be a finite non-negative number` },
          { status: 400 }
        )
      }
      if (item.stockbook_product_id !== undefined &&
          item.stockbook_product_id !== null &&
          (typeof item.stockbook_product_id !== 'string' || !UUID_RE.test(item.stockbook_product_id as string))) {
        return NextResponse.json(
          { error: `line_items[${i}].stockbook_product_id must be a valid UUID` },
          { status: 400 }
        )
      }
      lineItems.push({
        description:          desc,
        quantity,
        rate,
        amount,
        sort_order:           i,
        stockbook_product_id: typeof item.stockbook_product_id === 'string'
                                ? item.stockbook_product_id
                                : null,
      })
    }
  }

  // ─── Create invoice + line items atomically via RPC ────────────────────────
  // create_invoice_with_items() allocates the invoice number, inserts the
  // invoice, and inserts all line items in one PostgreSQL transaction.
  // Any failure rolls back completely — no ghost invoices, no wasted sequence numbers.

  const shareToken = randomBytes(32).toString('hex')

  const invoiceData = {
    share_token:         shareToken,
    status,
    issue_date:          issueDate,
    due_date:            dueDate,
    currency,
    discount_type:       discountType,
    subtotal,
    discount,
    discount_amount:     discountAmount,
    tax_rate:            taxRate,
    tax_amount:          taxAmount,
    total,
    is_recurring:        isRecurring,
    recurring_frequency: recurringFrequency,
    recurring_next_date: recurringNextDate,
    client_id:           clientId,
    business_name:       businessName,
    business_address:    businessAddress,
    business_email:      businessEmail,
    business_phone:      businessPhone,
    logo_url:            logoUrl,
    client_name:         clientName,
    client_company:      clientCompany,
    client_address:      clientAddress,
    client_email:        clientEmail,
    notes,
    brand_color:         brandColor,
    payment_details:     paymentDetails,
    template,
    language,
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc('create_invoice_with_items', {
    p_user_id:      user.id,
    p_invoice_data: invoiceData,
    p_line_items:   lineItems,
  })

  if (rpcError || !rpcResult) {
    logError('invoices/create', 'create_invoice_with_items RPC failed', { userId: user.id }, rpcError)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }

  const result = rpcResult as { invoice_id: string; invoice_number: string; share_token: string }

  return NextResponse.json({
    id:            result.invoice_id,
    invoiceNumber: result.invoice_number,
    shareToken:    result.share_token,
  })
}
