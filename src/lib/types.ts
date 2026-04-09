export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'pending'
export type Currency = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'CAD' | 'AUD'

export interface LineItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly'

export interface InvoiceData {
  invoiceNumber: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  currency: Currency
  businessName: string
  businessAddress: string
  businessEmail: string
  businessPhone: string
  logoUrl: string | null
  clientName: string
  clientCompany: string
  clientAddress: string
  clientEmail: string
  lineItems: LineItem[]
  taxRate: number
  notes: string
  brandColor: string
  isRecurring: boolean
  recurringFrequency: RecurringFrequency | null
}
