'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrencySymbol, CURRENCIES } from '@/lib/currencies'
import ClientCreditsTab from '@/components/ClientCreditsTab'

interface Client {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  currency: string
  created_at: string
  portal_token: string | null
}

const emptyForm = { name: '', company: '', email: '', phone: '', address: '', currency: 'NGN' }

export default function ClientsClient() {
  const [clients, setClients] = useState<Client[]>([])
  const [estimateCounts, setEstimateCounts] = useState<Record<string, number>>({})
  const [creditBalances, setCreditBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedCreditsId, setExpandedCreditsId] = useState<string | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('clients')
      .select('id, name, company, email, phone, address, currency, created_at, portal_token')
      .order('created_at', { ascending: false })
    setClients(data || [])

    // Load estimate counts per client
    const { data: estData } = await supabase
      .from('estimates')
      .select('client_id')
      .not('client_id', 'is', null)
    if (estData) {
      const counts: Record<string, number> = {}
      for (const row of estData) {
        if (row.client_id) counts[row.client_id] = (counts[row.client_id] || 0) + 1
      }
      setEstimateCounts(counts)
    }

    setLoading(false)

    if (data && data.length > 0 && user) {
      loadCreditBalances(data, user.id)
    }
  }

  async function loadCreditBalances(clients: Client[], userId: string) {
    const supabase = createClient()
    const clientIds = clients.map((c) => c.id)
    const clientCurrencyMap = Object.fromEntries(clients.map((c) => [c.id, c.currency || 'NGN']))

    const { data } = await supabase
      .from('client_credits')
      .select('client_id, amount, type, currency')
      .in('client_id', clientIds)
      .eq('user_id', userId)

    if (!data) return
    const balances: Record<string, number> = {}
    for (const row of data) {
      // Only count rows that match this client's configured currency
      if (row.currency !== clientCurrencyMap[row.client_id]) continue
      if (!balances[row.client_id]) balances[row.client_id] = 0
      if (row.type === 'credit_added') balances[row.client_id] += Number(row.amount)
      else if (row.type === 'credit_applied') balances[row.client_id] -= Number(row.amount)
      else if (row.type === 'credit_refunded') balances[row.client_id] -= Number(row.amount)
      else if (row.type === 'credit_adjusted') balances[row.client_id] += Number(row.amount)
    }
    setCreditBalances(balances)
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
      currency: client.currency || 'NGN',
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
        body: JSON.stringify({ ...form, currency: form.currency || 'NGN' }),
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

  function toggleCredits(clientId: string) {
    setExpandedCreditsId((prev) => (prev === clientId ? null : clientId))
  }

  const inputCls =
    'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'
  const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

  if (loading) {
    return <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">Loading clients...</div>
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage your saved client details</p>
        </div>
        <button
          onClick={openAdd}
          className="self-start sm:self-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          + Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          <div className="text-5xl mb-4">👤</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No clients yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
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
            {clients.map((client) => {
              const balance = creditBalances[client.id] ?? 0
              return (
                <div key={client.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{client.name}</p>
                      {client.company && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{client.company}</p>
                      )}
                      {balance > 0 && (
                        <span className="inline-flex items-center mt-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300 px-2 py-0.5 rounded-full">
                          {getCurrencySymbol(client.currency)}{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credit
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
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium px-2 py-1 rounded transition"
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
                    <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
                      {client.email && <p>{client.email}</p>}
                      {client.phone && <p>{client.phone}</p>}
                    </div>
                  )}
                  {(estimateCounts[client.id] || 0) > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                        {estimateCounts[client.id]} estimate{estimateCounts[client.id] !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  <div className="mt-3">
                    <button
                      onClick={() => toggleCredits(client.id)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      {expandedCreditsId === client.id ? '▲ Hide credits' : '▼ Manage credits'}
                    </button>
                    {expandedCreditsId === client.id && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <ClientCreditsTab clientId={client.id} clientName={client.name} currency={client.currency} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-700">
                  <th className="text-left px-6 py-3">Name</th>
                  <th className="text-left px-6 py-3">Company</th>
                  <th className="text-left px-6 py-3">Email</th>
                  <th className="text-left px-6 py-3">Phone</th>
                  <th className="text-center px-6 py-3">Estimates</th>
                  <th className="text-left px-4 py-3 whitespace-nowrap">Credit</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap w-px">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const balance = creditBalances[client.id] ?? 0
                  return (
                    <>
                      <tr
                        key={client.id}
                        className="border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{client.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{client.company || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{client.email || '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{client.phone || '—'}</td>
                        <td className="px-6 py-4 text-center">
                          {(estimateCounts[client.id] || 0) > 0 ? (
                            <span className="text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                              {estimateCounts[client.id]}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleCredits(client.id)}
                            className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full transition ${
                              balance > 0
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {balance > 0
                              ? `${getCurrencySymbol(client.currency)}${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} credit`
                              : 'Credits'}
                          </button>
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap w-px">
                          <div className="flex justify-end gap-1 flex-nowrap">
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
                              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium px-2 py-1 rounded transition"
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
                      {expandedCreditsId === client.id && (
                        <tr key={`${client.id}-credits`} className="bg-gray-50 dark:bg-gray-900/30">
                          <td colSpan={7} className="px-6 py-5">
                            <ClientCreditsTab clientId={client.id} clientName={client.name} currency={client.currency} />
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {editingClient ? 'Edit Client' : 'Add Client'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
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
              <div>
                <label className={labelCls}>Currency</label>
                <select
                  className={inputCls}
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.symbol} {c.code} - {c.label}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
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
