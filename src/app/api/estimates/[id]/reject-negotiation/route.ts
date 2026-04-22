import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { escHtml } from '@/lib/utils'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const rejectionNote = body.note || null

  const { data: estimate } = await supabase
    .from('estimates')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!estimate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (estimate.status !== 'revised') {
    return NextResponse.json({ error: 'Only revised estimates can be rejected' }, { status: 400 })
  }

  // Clear client_proposed_price from all line items
  await supabase
    .from('estimate_line_items')
    .update({ client_proposed_price: null })
    .eq('estimate_id', id)

  // Revert estimate status to 'sent' so client can review again
  await supabase
    .from('estimates')
    .update({ status: 'sent', updated_at: new Date().toISOString() })
    .eq('id', id)

  // Log event
  await supabase.from('estimate_events').insert({
    estimate_id: id,
    event_type: 'negotiation_rejected',
    actor: 'owner',
    details: rejectionNote ? { note: rejectionNote } : null,
  })

  // Email the client
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey && estimate.client_email) {
      const resend = new Resend(apiKey)
      const businessName = user.user_metadata?.business_name || user.email || 'Your service provider'
      const safeBusinessName = escHtml(businessName)
      const safeClientName = escHtml(estimate.client_name) || 'there'
      const safeEstimateNumber = escHtml(estimate.estimate_number)
      const safeTitle = estimate.title ? escHtml(estimate.title) : null
      const safeRejectionNote = rejectionNote ? escHtml(rejectionNote) : null
      await resend.emails.send({
        from: 'BillByDab <noreply@billbydab.com>',
        to: estimate.client_email,
        subject: `Update on estimate ${estimate.estimate_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #dc2626;">Negotiation Not Accepted</h2>
            <p>Hi ${safeClientName},</p>
            <p><strong>${safeBusinessName}</strong> was unable to accept the revised pricing on estimate <strong>${safeEstimateNumber}</strong>${safeTitle ? ` — ${safeTitle}` : ''}.</p>
            ${safeRejectionNote ? `<p style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px;"><strong>Note from ${safeBusinessName}:</strong> ${safeRejectionNote}</p>` : ''}
            <p>The original prices remain in effect. Please contact ${safeBusinessName} directly to discuss further.</p>
            <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Sent via BillByDab</p>
          </div>
        `,
      })
    }
  } catch (e) {
    console.error('Failed to email client on reject:', e)
  }

  return NextResponse.json({ success: true })
}
