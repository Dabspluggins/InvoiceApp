export const CURRENCIES = [
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'GHS', symbol: '₵', label: 'Ghanaian Cedi' },
  { code: 'KES', symbol: 'KSh', label: 'Kenyan Shilling' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand' },
  { code: 'XOF', symbol: 'CFA', label: 'West African CFA Franc' },
  { code: 'CNY', symbol: 'CN¥', label: 'Chinese Yuan (RMB)' },
  { code: 'JPY', symbol: 'JP¥', label: 'Japanese Yen' },
]

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? code
}
