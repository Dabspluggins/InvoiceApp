export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'pending'
export type EstimateStatus = 'draft' | 'sent' | 'client_reviewing' | 'revised' | 'approved' | 'rejected' | 'converted'

export interface EstimateLineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  deleted_by_client?: boolean
  sort_order?: number
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
  paymentDetails?: PaymentDetails
}
