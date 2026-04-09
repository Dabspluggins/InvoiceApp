'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { InvoiceStatus, Currency } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_company: string
  total: number
  currency: Currency
  status: InvoiceStatus
  issue_date: string
  is_recurring: boolean
}

interface Template {
  id: string
  name: string
  created_at: string
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

export default function DashboardClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadInvoices()
    loadTemplates()
  }, [])

  async function loadInvoices() {
    const supabase = createClient()
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, client_name, client_company, total, currency, status, issue_date, is_recurring')
      .order('created_at', { ascending: false })

    setInvoices(data || [])
    setLoading(false)
  }

  async function handleStatusChange(id: string, status: InvoiceStatus) {
    const supabase = createClient()
    await supabase.from('invoices').update({ status }).eq('id', id)
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, status } : inv)))
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('line_items').delete().eq('invoice_id', id)
    await supabase.from('invoices').delete().eq('id', id)
    setInvoices((prev) => prev.filter((inv) => inv.id !== id))
  }

  async function loadTemplates() {
    const supabase = createClient()
    const { data } = await supabase
      .from('templates')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
    setTemplates(data || [])
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('templates').delete().eq('id', id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  const totalInvoices = invoices.length
  const paidAmount = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + i.total, 0)
  const outstandingAmount = invoices
    .filter((i) => i.status === 'sent' || i.status === 'pending')
    .reduce((sum, i) => sum + i.total, 0)

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">Loading invoices...</div>
    )
  }

  return (
    <>
      {/* Stats — 2 columns on mobile, 3 on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 mb-1">Total Invoices</p>
          <p className="text-xl md:text-2xl font-bold text-blue-600">{totalInvoices}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 mb-1">Paid</p>
          <p className="text-xl md:text-2xl font-bold text-green-600">${paidAmount.toFixed(2)}</p>
        </div>
        <div className="col-span-2 md:col-span-1 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
          <p className="text-xs md:text-sm text-gray-500 mb-1">Outstanding</p>
          <p className="text-xl md:text-2xl font-bold text-orange-500">${outstandingAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 mb-6">
        <Link
          href="/clients"
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 hover:border-indigo-400 px-4 py-2 rounded-lg transition"
        >
          Manage Clients →
        </Link>
      </div>

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 md:p-12 text-center">
          <div className="text-5xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No invoices yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Create your first invoice and it will appear here.
          </p>
          <Link
            href="/invoice"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Create Invoice
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden flex flex-col gap-3">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer"
                onClick={() => router.push(`/invoice?id=${inv.id}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                      {inv.invoice_number}
                      {inv.is_recurring && <span title="Recurring">🔄</span>}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">{inv.client_name || '—'}</p>
                    {inv.client_company && (
                      <p className="text-xs text-gray-400">{inv.client_company}</p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {formatCurrency(inv.total, inv.currency)}
                  </p>
                </div>
                <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{inv.issue_date}</span>
                    <select
                      value={inv.status}
                      onChange={(e) => handleStatusChange(inv.id, e.target.value as InvoiceStatus)}
                      className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer border-0 outline-none ${STATUS_COLORS[inv.status]}`}
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <button
                    onClick={() => handleDelete(inv.id)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                  <th className="text-left px-6 py-3">Invoice</th>
                  <th className="text-left px-6 py-3">Client</th>
                  <th className="text-left px-6 py-3">Date</th>
                  <th className="text-right px-6 py-3">Amount</th>
                  <th className="text-center px-6 py-3">Status</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => router.push(`/invoice?id=${inv.id}`)}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <span className="flex items-center gap-1">
                        {inv.invoice_number}
                        {inv.is_recurring && <span title="Recurring">🔄</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>{inv.client_name || '—'}</div>
                      {inv.client_company && (
                        <div className="text-xs text-gray-400">{inv.client_company}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{inv.issue_date}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(inv.total, inv.currency)}
                    </td>
                    <td
                      className="px-6 py-4 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={inv.status}
                        onChange={(e) =>
                          handleStatusChange(inv.id, e.target.value as InvoiceStatus)
                        }
                        className={`text-xs font-medium px-2 py-1 rounded-full cursor-pointer border-0 outline-none ${STATUS_COLORS[inv.status]}`}
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                      </select>
                    </td>
                    <td
                      className="px-6 py-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Templates section */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Templates</h2>
        {templates.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No templates yet</h3>
            <p className="text-gray-500 text-sm">
              Save an invoice as a template and it will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden flex flex-col gap-3">
              {templates.map((tmpl) => (
                <div key={tmpl.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{tmpl.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(tmpl.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/invoice?template=${tmpl.id}`)}
                      className="flex-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
                    >
                      Use Template
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-6 py-3">Saved</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tmpl) => (
                    <tr
                      key={tmpl.id}
                      className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{tmpl.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(tmpl.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-4">
                        <button
                          onClick={() => router.push(`/invoice?template=${tmpl.id}`)}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700 transition"
                        >
                          Use Template
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
