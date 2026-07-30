import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

type ResendEvent = {
  type: string
  data: {
    email_id: string
    to?: string[]
    click?: { link: string }
  }
}

const STATUS_MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
}

const COUNTER_MAP: Record<string, string> = {
  'email.delivered': 'delivered_count',
  'email.opened': 'opened_count',
  'email.clicked': 'clicked_count',
  'email.bounced': 'bounced_count',
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const secret = process.env.RESEND_WEBHOOK_SECRET

  if (secret) {
    const wh = new Webhook(secret)
    try {
      wh.verify(rawBody, {
        'svix-id': request.headers.get('svix-id') ?? '',
        'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
        'svix-signature': request.headers.get('svix-signature') ?? '',
      })
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let event: ResendEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, data } = event
  const resendEmailId = data?.email_id

  if (!resendEmailId || !STATUS_MAP[type]) {
    return NextResponse.json({ ok: true })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: recipient } = await admin
    .from('announcement_recipients')
    .select('id, announcement_id')
    .eq('resend_email_id', resendEmailId)
    .single()

  if (!recipient) {
    return NextResponse.json({ ok: true })
  }

  const recipientUpdate: Record<string, unknown> = { status: STATUS_MAP[type] }
  if (type === 'email.opened') recipientUpdate.opened_at = new Date().toISOString()
  if (type === 'email.clicked') recipientUpdate.clicked_at = new Date().toISOString()

  await admin
    .from('announcement_recipients')
    .update(recipientUpdate)
    .eq('id', recipient.id)

  await admin.rpc('increment_announcement_counter', {
    log_id: recipient.announcement_id,
    field_name: COUNTER_MAP[type],
  })

  return NextResponse.json({ ok: true })
}
