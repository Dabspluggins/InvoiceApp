import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function parseNextInvoiceNumber(last: string): string {
  const match = last.match(/^(.*?)(\d+)$/)
  if (!match) return 'INV-0001'
  const prefix = match[1]
  const numStr = match[2]
  const next = parseInt(numStr, 10) + 1
  return prefix + String(next).padStart(numStr.length, '0')
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: latest } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const invoiceNumber = latest?.invoice_number
    ? parseNextInvoiceNumber(latest.invoice_number)
    : 'INV-0001'

  return NextResponse.json({ invoiceNumber })
}
