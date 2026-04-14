export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'pending' | 'partial'
export type EstimateStatus = 'draft' | 'sent' | 'client_reviewing' | 'revised' | 'approved' | 'rejected' | 'converted'

export type SavedPaymentMethod = {
  id: string
  type: 'bank_transfer' | 'mobile_money' | 'other'
  label: string
  // Bank Transfer
  accountName?: string
  accountNumber?: string
  bankName?: string
  // Mobile Money
  mmAccountName?: string
  mmPhone?: string
  mmNetwork?: string
  // Other
  otherLabel?: string
  otherDetails?: string
}

export interface Payment {
  id: string
  invoice_id: string
  user_id: string
  amount: number
  paid_at: string
  note: string | null
  created_at: string
}

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
