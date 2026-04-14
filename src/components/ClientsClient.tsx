'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  created_at: string
  portal_token: string | null
}

interface CreditRecord {
  id: string
  client_id: string
  amount: number
  type: 'credited' | 'applied'
  description: string | null
  created_at: string
}

const emptyForm = { name: '', company: '', email: '', phone: '', address: '' }

export default function ClientsClient() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [clientCredits, setClientCredits] = useState<Record<string, { balance: number; history: CreditRecord[] }>>({})
  const [expandedCreditId, setExpandedCreditId] = useState<string | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    const supabase = createClient()
    const { data } = await supabase
      .from('clients')
      .select('id, name, company, email, phone, address, created_at, portal_token')
      .order('created_at', { ascending: false })
    setClients(data || [])
    setLoading(false)
    if (data && data.length > 0) {
      await loadClientCredits(data.map((c) => c.id))
    }
  }

  async function loadClientCredits(clientIds: string[]) {
    if (clientIds.length === 0) return
    const supabase = createClient()
    const { data: credits } = await supabase
      .from('client_credits')
      .select('id, client_id, amount, type, description, created_at')
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })

    const map: Record<string, { balance: number; history: CreditRecord[] }> = {}
    for (const credit of credits || []) {
      if (!map[credit.client_id]) map[credit.client_id] = { balance: 0, history: [] }
      map[credit.client_id].history.push(credit as CreditRecord)
      if (credit.type === 'credited') map[credit.client_id].balance += Number(credit.amount)
      else map[credit.client_id].balance -= Number(credit.amount)
    }
    setClientCredits(map)
  }

  async function handleCopyPortalLink(client: Client) {
    if (!client.portal_token) return
    const url = `https://www.billbydab.com/portal/${client.portal_token}`
    await navigator.clipboard.writeText(url)
    setCopiedId(client.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function openAdd() {
    setEditingClient(null)
    setForm(emptyForm)
    setError(null)
    setShowModal(true)
  }

  function openEdit(client: Client) {
    setEditingClient(client)
    setForm({
      name: client.name,
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
    })
    setError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingClient(null)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const url = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients'
      const method = editingClient ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save client')

      if (editingClient) {
        setClients((prev) => prev.map((c) => (c.id === editingClient.id ? json : c)))
      } else {
        setClients((prev) => [json, ...prev])
      }
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this client? This cannot be undone.')) return
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setClients((prev) => prev.filter((c) => c.id !== id))
    }
  }

  const inputCls =
    'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  if (loading) {
    return <div className="text-center py-16 text-gray-400 text-sm">Loading clients...</div>
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your saved client details</p>
        </div>
        <button
          onClick={openAdd}
          className="self-start sm:self-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          + Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 md:p-12 text-center">
          <div className="text-5xl mb-4">👤</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No clients yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Save client details here to quickly fill invoices.
          </p>
          <button
            onClick={openAdd}
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Add Client
          </button>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden flex flex-col gap-3">
            {clients.map((client) => (
              <div key={client.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{client.name}</p>
                    {client.company && (
                      <p className="text-xs text-gray-500 mt-0.5">{client.company}</p>
                    )}
                    {(clientCredits[client.id]?.balance ?? 0) > 0 && (
                      <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                        ₦{(clientCredits[client.id]?.balance ?? 0).toLocaleString()} credit
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {client.portal_token && (
                      <button
                        onClick={() => handleCopyPortalLink(client)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-medium px-2 py-1 rounded transition"
                      >
                        {copiedId === client.id ? 'Copied!' : '🔗 Portal link'}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(client)}
                      className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 font-medium px-2 py-1 rounded transition"
                    >
                      ✎ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 font-medium px-2 py-1 rounded transition"
                    >
                      ✕ Delete
                    </button>
                  </div>
                </div>
                {(client.email || client.phone) && (
                  <div className="text-xs text-gray-400 space-y-0.5">
                    {client.email && <p>{client.email}</p>}
                    {client.phone && <p>{client.phone}</p>}
                  </div>
                )}
                {(clientCredits[client.id]?.history ?? []).length > 0 && (
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    <button
                      onClick={() => setExpandedCreditId(expandedCreditId === client.id ? null : client.id)}
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                    >
                      {expandedCreditId === client.id ? '▲ Hide credit history' : '▼ Credit History'}
                    </button>
                    {expandedCreditId === client.id && (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-100">
                              <th className="text-left py-1 pr-3">Date</th>
                              <th className="text-left py-1 pr-3">Type</th>
                              <th className="text-right py-1 pr-3">Amount</th>
                              <th className="text-left py-1">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientCredits[client.id].history.map((record) => (
                              <tr key={record.id} className="border-b border-gray-50 last:border-0">
                                <td className="py-1 pr-3 text-gray-500">{new Date(record.created_at).toLocaleDateString('en-GB')}</td>
                                <td className="py-1 pr-3">
                                  <span className={record.type === 'credited' ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>
                                    {record.type}
                                  </span>
                                </td>
                                <td className="py-1 pr-3 text-right font-medium">₦{Number(record.amount).toLocaleString()}</td>
                                <td className="py-1 text-gray-400">{record.description || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                  <th className="text-left px-6 py-3">Name</th>
                  <th className="text-left px-6 py-3">Company</th>
                  <th className="text-left px-6 py-3">Email</th>
                  <th className="text-left px-6 py-3">Phone</th>
                  <th className="text-left px-6 py-3">Credit</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <React.Fragment key={client.id}>
                  <tr
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{client.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{client.company || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{client.email || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{client.phone || '—'}</td>
                    <td className="px-6 py-4">
                      {(clientCredits[client.id]?.balance ?? 0) > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                            ₦{(clientCredits[client.id]?.balance ?? 0).toLocaleString()} credit
                          </span>
                          <button
                            onClick={() => setExpandedCreditId(expandedCreditId === client.id ? null : client.id)}
                            className="text-xs text-indigo-500 hover:text-indigo-700"
                            title="Toggle credit history"
                          >
                            {expandedCreditId === client.id ? '▲' : '▼'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        {client.portal_token && (
                          <button
                            onClick={() => handleCopyPortalLink(client)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-medium px-2 py-1 rounded transition"
                          >
                            {copiedId === client.id ? 'Copied!' : '🔗 Portal link'}
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(client)}
                          className="text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 font-medium px-2 py-1 rounded transition"
                        >
                          ✎ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(client.id)}
                          className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 font-medium px-2 py-1 rounded transition"
                        >
                          ✕ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedCreditId === client.id && (clientCredits[client.id]?.history ?? []).length > 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-1 pr-4">Date</th>
                              <th className="text-left py-1 pr-4">Type</th>
                              <th className="text-right py-1 pr-4">Amount</th>
                              <th className="text-left py-1">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {clientCredits[client.id].history.map((record) => (
                              <tr key={record.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                                <td className="py-1 pr-4 text-gray-500">{new Date(record.created_at).toLocaleDateString('en-GB')}</td>
                                <td className="py-1 pr-4">
                                  <span className={record.type === 'credited' ? 'text-green-600 font-medium' : 'text-orange-500 font-medium'}>
                                    {record.type}
                                  </span>
                                </td>
                                <td className="py-1 pr-4 text-right font-medium">₦{Number(record.amount).toLocaleString()}</td>
                                <td className="py-1 text-gray-400">{record.description || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editingClient ? 'Edit Client' : 'Add Client'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Name <span className="text-red-500">*</span></label>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith"
                  autoFocus
                />
              </div>
              <div>
                <label className={labelCls}>Company</label>
                <input
                  className={inputCls}
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Client Co."
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  className={inputCls}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 555 000 0000"
                />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="456 Client Ave, City, State"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="text-sm bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingClient ? 'Save Changes' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
