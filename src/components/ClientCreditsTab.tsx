'use client'

import { useState, useEffect, useCallback } from 'react'
import { getCurrencySymbol } from '@/lib/currencies'

type CreditType = 'credit_added' | 'credit_applied' | 'credit_refunded' | 'credit_adjusted'

interface CreditRow {
  id: string
  amount: number
  type: CreditType
  description: string | null
  reference_number: string | null
  invoice_id: string | null
  created_at: string
}

interface Props {
  clientId: string
  clientName: string
  currency?: string
}

const TYPE_LABELS: Record<CreditType, string> = {
  credit_added:    'Deposit',
  credit_applied:  'Applied',
  credit_refunded: 'Refunded',
  credit_adjusted: 'Adjusted',
}

const TYPE_COLORS: Record<CreditType, string> = {
  credit_added:    'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  credit_applied:  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  credit_refunded: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  credit_adjusted: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAmount(amount: number) {
  return Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getAmountSign(row: CreditRow): '+' | '−' {
  if (row.type === 'credit_added') return '+'
  if (row.type === 'credit_adjusted') return row.amount >= 0 ? '+' : '−'
  return '−'
}

function getAmountColor(row: CreditRow): string {
  if (row.type === 'credit_added') return 'text-green-600 dark:text-green-400'
  if (row.type === 'credit_applied') return 'text-blue-600 dark:text-blue-400'
  if (row.type === 'credit_adjusted' && row.amount >= 0) return 'text-green-600 dark:text-green-400'
  return 'text-orange-500 dark:text-orange-400'
}

const emptyForm = { amount: '', description: '', referenceNumber: '' }

export default function ClientCreditsTab({ clientId, clientName, currency = 'NGN' }: Props) {
  const [rows, setRows] = useState<CreditRow[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const symbol = getCurrencySymbol(currency)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/credits?clientId=${clientId}&currency=${encodeURIComponent(currency)}`)
    if (res.ok) {
      const json = await res.json()
      setRows(json.rows || [])
      setBalance(json.balance ?? 0)
    }
    setLoading(false)
  }, [clientId, currency])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Amount must be greater than zero')
      return
    }
    setSaving(true)
    setFormError(null)
    const res = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        amount,
        description: form.description.trim() || null,
        referenceNumber: form.referenceNumber.trim() || null,
        currency,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const json = await res.json()
      setFormError(json.error || 'Failed to add deposit')
      return
    }
    setForm(emptyForm)
    setShowForm(false)
    showToast('Deposit added')
    load()
  }

  async function handleDelete(row: CreditRow) {
    if (!confirm(`Reverse this ${symbol}${formatAmount(row.amount)} deposit? This cannot be undone.`)) return
    setDeletingId(row.id)
    const res = await fetch(`/api/credits/${row.id}`, { method: 'DELETE' })
    setDeletingId(null)
    if (!res.ok) {
      const json = await res.json()
      showToast(json.error || 'Failed to reverse deposit')
      return
    }
    showToast('Deposit reversed')
    load()
  }

  const inputCls = 'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'
  const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white bg-green-600">
          {toast}
        </div>
      )}

      {/* Balance banner */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">
            Available deposit — {clientName}
          </p>
          <p className={`text-2xl font-bold mt-0.5 ${balance > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
            {symbol}{formatAmount(balance)}
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null); setForm(emptyForm) }}
          className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
        >
          {showForm ? 'Cancel' : '+ Add Deposit'}
        </button>
      </div>

      {/* Add credit form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800 dark:text-white">Record advance payment / deposit</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount ({currency}) <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={inputCls}
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls}>Reference no. (optional)</label>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. CHQ-001"
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description (optional)</label>
            <input
              type="text"
              className={inputCls}
              placeholder="e.g. Advance payment for project"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {formError && <p className="text-xs text-red-500">{formError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-600 dark:text-gray-300 px-4 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm bg-green-600 text-white px-5 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Deposit'}
            </button>
          </div>
        </form>
      )}

      {/* Credit ledger */}
      {loading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400 dark:text-gray-500">No deposit history yet.</p>
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Add a deposit above to get started.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5">Date</th>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">Description</th>
                  <th className="text-left px-4 py-2.5">Ref</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[row.type]}`}>
                        {TYPE_LABELS[row.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.description || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs">{row.reference_number || '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${getAmountColor(row)}`}>
                      {getAmountSign(row)}{symbol}{formatAmount(row.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.type === 'credit_added' && (
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={deletingId === row.id}
                          title="Reverse this deposit"
                          className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition text-base leading-none disabled:opacity-40"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 dark:border-gray-600">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Balance</td>
                  <td className={`px-4 py-3 text-right font-bold ${balance > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {symbol}{formatAmount(balance)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[row.type]}`}>
                        {TYPE_LABELS[row.type]}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(row.created_at)}</span>
                    </div>
                    {row.description && <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{row.description}</p>}
                    {row.reference_number && <p className="text-xs text-gray-400 dark:text-gray-500">Ref: {row.reference_number}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-semibold ${getAmountColor(row)}`}>
                      {getAmountSign(row)}{symbol}{formatAmount(row.amount)}
                    </span>
                    {row.type === 'credit_added' && (
                      <button
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.id}
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition text-lg leading-none disabled:opacity-40"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="text-right pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Balance: </span>
              <span className={`text-sm font-bold ${balance > 0 ? 'text-green-600' : 'text-gray-500'}`}>{symbol}{formatAmount(balance)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
