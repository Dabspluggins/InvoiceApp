export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'pending' | 'partial'

export interface Payment {
  id: string
  invoice_id: string
  user_id: string
  amount: number
  paid_at: string
  note: string | null
  created_at: string
}

export interface PaymentDetails {
  bankTransfer?: {
    accountName?: string
    bankName?: string
    accountNumber?: string
    routingNumber?: string
    swiftIban?: string
  }
  mobileMoney?: {
    provider?: string
    phoneNumber?: string
  }
  other?: {
    paymentMethod?: string
    details?: string
  }
}
export type Currency = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'CAD' | 'AUD' | 'GHS' | 'KES' | 'ZAR' | 'XOF' | 'CNY' | 'JPY'

export interface LineItem {
  id: string
  description: string
  quantity: number
  rate: number
  amount: number
}

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly'

export type InvoiceTemplate = 'minimal' | 'classic' | 'bold'

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
  discount: number
  discountType: 'percent' | 'fixed'
  notes: string
  brandColor: string
  isRecurring: boolean
  recurringFrequency: RecurringFrequency | null
  paymentDetails?: PaymentDetails
  template?: InvoiceTemplate
}
