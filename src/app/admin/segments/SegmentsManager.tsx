'use client'

import { useState, useEffect, useCallback } from 'react'

type Segment = {
  id: string
  name: string
  description: string | null
  rules: ApiRule[]
  created_at: string
  created_by: string | null
}

type ApiRule = {
  field: string
  operator: string
  value: string | number | boolean
}

type UiRule = {
  field: string
  operator: string
  value: string
}

type PreviewResult = {
  count: number
  userIds: string[]
}

const FIELD_OPTIONS = [
  { value: 'created_at', label: 'Account created' },
  { value: 'email_updates', label: 'Email updates' },
  { value: 'invoice_count', label: 'Invoice count' },
  { value: 'days_since_active', label: 'Days since active' },
]

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
  created_at: [
    { value: 'after', label: 'after' },
    { value: 'before', label: 'before' },
  ],
  email_updates: [
    { value: 'equals', label: 'is' },
  ],
  invoice_count: [
    { value: 'gt', label: 'greater than' },
    { value: 'lt', label: 'less than' },
    { value: 'eq', label: 'equal to' },
  ],
  days_since_active: [
    { value: 'lt', label: 'less than (days)' },
    { value: 'gt', label: 'greater than (days)' },
  ],
}

function defaultOperator(field: string) {
  return OPERATOR_OPTIONS[field]?.[0]?.value ?? 'equals'
}

function defaultValue(field: string) {
  if (field === 'email_updates') return 'true'
  if (field === 'created_at') return new Date().toISOString().split('T')[0]
  return ''
}

function makeRule(): UiRule {
  return { field: 'created_at', operator: 'after', value: new Date().toISOString().split('T')[0] }
}

function coerceRule(r: UiRule): ApiRule {
  if (r.field === 'email_updates') return { ...r, value: r.value === 'true' }
  if (r.field === 'invoice_count' || r.field === 'days_since_active') {
    return { ...r, value: Number(r.value) }
  }
  return r
}

const inputCls =
  'border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
const selectCls =
  'border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

function ValueInput({ rule, onChange }: { rule: UiRule; onChange: (val: string) => void }) {
  if (rule.field === 'created_at') {
    return (
      <input
        type="date"
        value={rule.value}
        onChange={e => onChange(e.target.value)}
        className={inputCls}
      />
    )
  }
  if (rule.field === 'email_updates') {
    return (
      <select value={rule.value} onChange={e => onChange(e.target.value)} className={selectCls}>
        <option value="true">Yes (opted in)</option>
        <option value="false">No (opted out)</option>
      </select>
    )
  }
  return (
    <input
      type="number"
      min="0"
      value={rule.value}
      onChange={e => onChange(e.target.value)}
      placeholder="0"
      className={`${inputCls} w-28`}
    />
  )
}

export default function SegmentsManager() {
  const [view, setView] = useState<'list' | 'builder'>('list')
  const [segments, setSegments] = useState<Segment[]>([])
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Builder state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState<UiRule[]>([makeRule()])
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadSegments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/segments')
      if (!res.ok) throw new Error('Failed to load')
      const data: Segment[] = await res.json()
      setSegments(data)

      // Fetch user counts in parallel
      setCounts(Object.fromEntries(data.map(s => [s.id, null])))
      Promise.all(
        data.map(async seg => {
          try {
            const r = await fetch('/api/admin/segments/preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ rules: seg.rules }),
            })
            const d = await r.json()
            return [seg.id, r.ok ? (d.count as number) : 0] as const
          } catch {
            return [seg.id, 0] as const
          }
        })
      ).then(results => {
        setCounts(Object.fromEntries(results))
      })
    } catch {
      // silently fail — empty state shows
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSegments() }, [loadSegments])

  function openBuilder() {
    setName('')
    setDescription('')
    setRules([makeRule()])
    setPreviewResult(null)
    setError(null)
    setSuccess(null)
    setView('builder')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this segment? This cannot be undone.')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/segments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      await loadSegments()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function handlePreview() {
    setPreviewResult(null)
    setError(null)
    setPreviewing(true)
    try {
      const res = await fetch('/api/admin/segments/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: rules.map(coerceRule) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Preview failed')
      setPreviewResult(json as PreviewResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  async function handleSave() {
    setError(null)
    setSuccess(null)
    if (!name.trim()) { setError('Name is required'); return }
    if (rules.length === 0) { setError('Add at least one rule'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          rules: rules.map(coerceRule),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setSuccess('Segment saved!')
      await loadSegments()
      setTimeout(() => setView('list'), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function updateRule(i: number, patch: Partial<UiRule>) {
    setRules(prev => {
      const next = [...prev]
      const current = next[i]
      const updated: UiRule = { ...current, ...patch }
      if (patch.field && patch.field !== current.field) {
        updated.operator = defaultOperator(patch.field)
        updated.value = defaultValue(patch.field)
      }
      next[i] = updated
      return next
    })
    setPreviewResult(null)
  }

  // ── List view ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loading ? 'Loading…' : `${segments.length} segment${segments.length !== 1 ? 's' : ''}`}
          </p>
          <button
            onClick={openBuilder}
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            New Segment
          </button>
        </div>

        {!loading && segments.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No segments yet. Create one to start targeting announcements.</p>
          </div>
        )}

        <div className="space-y-3">
          {segments.map(seg => (
            <div
              key={seg.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-6 py-4 flex items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{seg.name}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                    {counts[seg.id] === null || counts[seg.id] === undefined
                      ? '…'
                      : `${(counts[seg.id] as number).toLocaleString()} users`}
                  </span>
                </div>
                {seg.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{seg.description}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Created {new Date(seg.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(seg.id)}
                disabled={deletingId === seg.id}
                className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors shrink-0 mt-0.5"
              >
                {deletingId === seg.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Builder view ───────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">New Segment</h2>
        <button
          onClick={() => setView('list')}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Name + description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Segment name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Active power users"
              className={`${inputCls} w-full`}
            />
          </div>
          <div>
            <label className={labelCls}>Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description"
              className={`${inputCls} w-full`}
            />
          </div>
        </div>

        {/* Rules builder */}
        <div>
          <label className={labelCls}>Rules (all must match)</label>
          <div className="space-y-3">
            {rules.map((rule, i) => (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                {/* Field */}
                <select
                  value={rule.field}
                  onChange={e => updateRule(i, { field: e.target.value })}
                  className={selectCls}
                >
                  {FIELD_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {/* Operator */}
                <select
                  value={rule.operator}
                  onChange={e => updateRule(i, { operator: e.target.value })}
                  className={selectCls}
                >
                  {(OPERATOR_OPTIONS[rule.field] ?? []).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {/* Value */}
                <ValueInput rule={rule} onChange={val => updateRule(i, { value: val })} />

                {/* Remove */}
                {rules.length > 1 && (
                  <button
                    onClick={() => {
                      setRules(prev => prev.filter((_, idx) => idx !== i))
                      setPreviewResult(null)
                    }}
                    className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 text-sm transition-colors px-1"
                    aria-label="Remove rule"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setRules(prev => [...prev, makeRule()])
              setPreviewResult(null)
            }}
            className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            + Add rule
          </button>
        </div>

        {/* Preview result */}
        {previewResult && (
          <div className="text-sm px-4 py-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
            <strong>{previewResult.count.toLocaleString()} users</strong> match this segment.
          </div>
        )}

        {/* Error / success */}
        {error && (
          <div className="text-sm px-4 py-3 rounded-lg border bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="text-sm px-4 py-3 rounded-lg border bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
            {success}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end pt-2">
          <button
            onClick={handlePreview}
            disabled={previewing || rules.length === 0}
            className="text-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {previewing ? 'Previewing…' : 'Preview'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || rules.length === 0}
            className="text-sm bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {saving ? 'Saving…' : 'Save Segment'}
          </button>
        </div>
      </div>
    </div>
  )
}
