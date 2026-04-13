'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

type ExpenseCategory = 'Travel' | 'Software' | 'Materials' | 'Meals' | 'Marketing' | 'Other'
type ExpenseFilter = 'all' | 'unbilled' | 'billed' | 'not-billable'

interface Expense {
  id: string
  description: string
  amount: number
  currency: string
  date: string
  category: ExpenseCategory
  notes: string | null
  billable: boolean
  billed: boolean
  client_id: string | null
  invoice_id: string | null
  created_at: string
}

interface Client {
  id: string
  name: string
  company: string | null
}

const CATEGORIES: ExpenseCategory[] = ['Travel', 'Software', 'Materials', 'Meals', 'Marketing', 'Other']

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Travel: 'bg-blue-100 text-blue-700',
  Software: 'bg-purple-100 text-purple-700',
  Materials: 'bg-orange-100 text-orange-700',
  Meals: 'bg-green-100 text-green-700',
  Marketing: 'bg-pink-100 text-pink-700',
  Other: 'bg-gray-100 text-gray-600',
}

const FILTER_PILLS: { label: string; value: ExpenseFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unbilled', value: 'unbilled' },
  { label: 'Billed', value: 'billed' },
  { label: 'Not Billable', value: 'not-billable' },
]

const emptyForm = {
  description: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  client_id: '',
  category: 'Other' as ExpenseCategory,
  notes: '',
  billable: true,
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ExpensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ExpenseFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const [{ data: expData }, { data: clientData }] = await Promise.all([
      supabase.from('expenses').select('*').order('date', { ascending: false }),
      supabase.from('clients').select('id, name, company').order('name'),
    ])
    setExpenses(expData || [])
    setClients(clientData || [])
    setLoading(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function openAdd() {
    setEditingExpense(null)
    setForm(emptyForm)
    setFormError(null)
    setShowForm(true)
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense)
    setForm({
      description: expense.description,
      amount: expense.amount.toString(),
      date: expense.date,
      client_id: expense.client_id || '',
      category: expense.category,
      notes: expense.notes || '',
      billable: expense.billable,
    })
    setFormError(null)
    setShowForm(true)
  }

  async function handleSubmit() {
    if (!form.description.trim()) {
      setFormError('Description is required.')
      return
    }
    const amt = parseFloat(form.amount)
    if (!form.amount || isNaN(amt) || amt <= 0) {
      setFormError('Enter a valid amount.')
      return
    }
    if (!form.date) {
      setFormError('Date is required.')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const payload = {
        user_id: user.id,
        description: form.description.trim(),
        amount: amt,
        currency: 'NGN',
        date: form.date,
        client_id: form.client_id || null,
        category: form.category,
        notes: form.notes.trim() || null,
        billable: form.billable,
      }

      if (editingExpense) {
        const { data, error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingExpense.id)
          .select()
          .single()
        if (error) throw error
        setExpenses((prev) => prev.map((e) => (e.id === editingExpense.id ? data : e)))
        showToast('Expense updated.')
      } else {
        const { data, error } = await supabase
          .from('expenses')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        setExpenses((prev) => [data, ...prev])
        showToast('Expense added.')
      }

      setShowForm(false)
      setEditingExpense(null)
    } catch (err) {
      console.error(err)
      setFormError('Failed to save expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense? This cannot be undone.')) return
    const supabase = createClient()
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    showToast('Expense deleted.')
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filter === 'unbilled') return e.billable && !e.billed
      if (filter === 'billed') return e.billed
      if (filter === 'not-billable') return !e.billable
      return true
    })
  }, [expenses, filter])

  const unbilledTotal = useMemo(
    () => expenses.filter((e) => e.billable && !e.billed).reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  )

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])

  if (loading) {
    return <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm">Loading expenses...</div>
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white bg-green-600">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Track billable and non-billable expenses per client.</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          + Add Expense
        </button>
      </div>

      {/* Unbilled summary stat */}
      {unbilledTotal > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">Unbilled Expenses</p>
            <p className="text-2xl font-bold text-amber-700 mt-0.5">{formatCurrency(unbilledTotal, 'NGN')}</p>
          </div>
          <div className="text-amber-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {FILTER_PILLS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
              filter === value
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-300 hover:text-indigo-600 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Expenses list */}
      {expenses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 md:p-12 text-center">
          <div className="text-5xl mb-4">🧾</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No expenses yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Log your first expense to start tracking billable costs.</p>
          <button
            onClick={openAdd}
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-indigo-700"
          >
            Add Expense
          </button>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No expenses match this filter.
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden flex flex-col gap-3">
            {filteredExpenses.map((exp) => {
              const client = exp.client_id ? clientMap.get(exp.client_id) : null
              return (
                <div key={exp.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{exp.description}</p>
                      {client && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{client.name}{client.company ? ` · ${client.company}` : ''}</p>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white shrink-0">{formatCurrency(exp.amount, exp.currency)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(exp.date)}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[exp.category] ?? 'bg-gray-100 text-gray-600'}`}>
                      {exp.category}
                    </span>
                    {exp.billed ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Billed</span>
                    ) : exp.billable ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Unbilled</span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not Billable</span>
                    )}
                  </div>
                  {exp.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 truncate">{exp.notes}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(exp)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-700">
                  <th className="text-left px-6 py-3">Date</th>
                  <th className="text-left px-6 py-3">Description</th>
                  <th className="text-left px-6 py-3">Client</th>
                  <th className="text-left px-6 py-3">Category</th>
                  <th className="text-right px-6 py-3">Amount</th>
                  <th className="text-center px-6 py-3">Status</th>
                  <th className="text-right px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((exp) => {
                  const client = exp.client_id ? clientMap.get(exp.client_id) : null
                  return (
                    <tr key={exp.id} className="border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(exp.date)}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{exp.description}</p>
                        {exp.notes && <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">{exp.notes}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {client ? (
                          <div>
                            <div>{client.name}</div>
                            {client.company && <div className="text-xs text-gray-400 dark:text-gray-500">{client.company}</div>}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[exp.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white text-right whitespace-nowrap">
                        {formatCurrency(exp.amount, exp.currency)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {exp.billed ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Billed</span>
                        ) : exp.billable ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Unbilled</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not Billable</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => openEdit(exp)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingExpense(null) }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Figma subscription"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount (₦) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Client (optional)</label>
                <select
                  value={form.client_id}
                  onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">No client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.company ? ` (${c.company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Any additional details..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Billable toggle */}
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.billable}
                    onChange={(e) => setForm((f) => ({ ...f, billable: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Billable to client</span>
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowForm(false); setEditingExpense(null) }}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : editingExpense ? 'Update' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
