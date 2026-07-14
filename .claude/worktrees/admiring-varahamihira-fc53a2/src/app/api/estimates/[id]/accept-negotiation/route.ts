import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (estimate.status !== 'revised') {
    return NextResponse.json({ error: 'Only revised estimates can be accepted' }, { status: 400 })
  }

  // Update status to approved
  await supabase
    .from('estimates')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', id)

  // Log event
  await supabase.from('estimate_events').insert({
    estimate_id: id,
    event_type: 'negotiation_accepted',
    actor: 'owner',
  })

  // Email the client to notify them their negotiation was accepted
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey && estimate.client_email) {
      const resend = new Resend(apiKey)
      const businessName = user.user_metadata?.business_name || user.email || 'Your service provider'
      await resend.emails.send({
        from: 'BillByDab <noreply@billbydab.com>',
        to: estimate.client_email,
        subject: `Your negotiation on estimate ${estimate.estimate_number} has been accepted`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #16a34a;">Negotiation Accepted ✓</h2>
            <p>Hi ${estimate.client_name || 'there'},</p>
            <p><strong>${businessName}</strong> has accepted your revised pricing on estimate <strong>${estimate.estimate_number}</strong>${estimate.title ? ` — ${estimate.title}` : ''}.</p>
            <p>They will now proceed to create your invoice at the agreed prices. You should receive it shortly.</p>
            <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Sent via BillByDab</p>
          </div>
        `,
      })
    }
  } catch (e) {
    console.error('Failed to email client on accept:', e)
  }

  return NextResponse.json({ success: true })
}
