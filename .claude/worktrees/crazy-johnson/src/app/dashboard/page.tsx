import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Welcome back, {user.email}</p>
          </div>
          <Link href="/invoice" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700">
            + New Invoice
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Invoices', value: '0', color: 'text-blue-600' },
            { label: 'Paid', value: '$0.00', color: 'text-green-600' },
            { label: 'Outstanding', value: '$0.00', color: 'text-orange-500' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-6">
              <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Empty state */}
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No invoices yet</h3>
          <p className="text-gray-500 text-sm mb-6">Create your first invoice and it will appear here.</p>
          <Link href="/invoice" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700">
            Create Invoice
          </Link>
        </div>
      </div>
    </div>
  )
}
