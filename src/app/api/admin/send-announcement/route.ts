import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { announcementLimiter } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { success, reset } = await announcementLimiter.limit(user.id)
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter },
        { status: 429 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
    }

    const body = await req.json()
    const { subject, html, recipients } = body as {
      subject?: string
      html?: string
      recipients?: string[]
    }

    if (!subject || !html || !recipients?.length) {
      return NextResponse.json({ error: 'subject, html, and recipients are required' }, { status: 400 })
    }

    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'BillByDab <invoices@billbydab.com>',
      to: recipients,
      subject,
      html,
    })

    if (error) {
      console.error('Resend announcement error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('send-announcement error:', err)
    return NextResponse.json({ error: 'Failed to send announcement' }, { status: 500 })
  }
}
