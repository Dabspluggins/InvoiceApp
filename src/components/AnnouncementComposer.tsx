'use client'

import { useState, useEffect, useMemo } from 'react'

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
const textareaCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition resize-none'
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

type User = {
  id: string
  email: string
  full_name: string | null
  created_at: string
  email_updates: boolean | null
}

export default function AnnouncementComposer() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const [mode, setMode] = useState<'all' | 'specific'>('all')
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (mode !== 'specific' || users.length > 0) return
    setUsersLoading(true)
    setUsersError(null)
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data)
        else setUsersError((data as { error?: string }).error ?? 'Failed to load users')
      })
      .catch(() => setUsersError('Failed to load users'))
      .finally(() => setUsersLoading(false))
  }, [mode, users.length])

  const optInCount = useMemo(() => users.filter(u => u.email_updates).length, [users])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      u =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name?.toLowerCase().includes(q) ?? false)
    )
  }, [users, search])

  function toggleUser(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function removeSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const selectedUsers = useMemo(() => users.filter(u => selectedIds.has(u.id)), [users, selectedIds])

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.')
      return
    }
    if (mode === 'specific' && selectedIds.size === 0) {
      setError('Select at least one recipient.')
      return
    }
    setSending(true)
    setError(null)
    setResult(null)

    try {
      const payload: Record<string, unknown> = { title: title.trim(), body: body.trim() }
      if (mode === 'specific') {
        payload.recipientIds = Array.from(selectedIds)
      }
      const res = await fetch('/api/admin/send-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error((json as { error?: string }).error ?? 'Failed to send')
      setResult({ sent: (json as { sent: number }).sent, skipped: (json as { skipped?: number }).skipped ?? 0 })
      setTitle('')
      setBody('')
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  const previewParagraphs = body
    .split(/\n\n+/)
    .map(para => para.replace(/\n/g, '<br>'))

  const sendLabel = sending
    ? 'Sending...'
    : mode === 'specific'
    ? `Send to ${selectedIds.size} selected user${selectedIds.size === 1 ? '' : 's'}`
    : 'Send to all opted-in users'

  const canSend = !sending && !!title.trim() && !!body.trim() && (mode === 'all' || selectedIds.size > 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Compose Announcement</h2>
        <button
          onClick={() => setPreview(p => !p)}
          className="text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
        >
          {preview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      <div className={`${preview ? 'grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 dark:divide-gray-700' : ''}`}>
        {/* Composer */}
        <div className="p-6 space-y-4">
          {/* Recipient selector */}
          <div>
            <label className={labelCls}>Recipients</label>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden w-fit mb-3">
              <button
                onClick={() => setMode('all')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  mode === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                All opted-in users
              </button>
              <button
                onClick={() => setMode('specific')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 dark:border-gray-600 ${
                  mode === 'specific'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                Specific users
              </button>
            </div>

            {mode === 'all' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {users.length > 0
                  ? `${optInCount} user${optInCount === 1 ? '' : 's'} opted in to receive announcements.`
                  : 'Sends to all users who have opted in to product updates.'}
              </p>
            )}

            {mode === 'specific' && (
              <div className="space-y-2">
                {/* Selected chips */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                    {selectedUsers.map(u => (
                      <span
                        key={u.id}
                        className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-full"
                      >
                        {u.full_name ?? u.email.split('@')[0]}
                        <button
                          onClick={() => removeSelected(u.id)}
                          className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 leading-none"
                          aria-label={`Remove ${u.email}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search */}
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className={inputCls}
                />

                {/* User list */}
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
                  {usersLoading ? (
                    <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">Loading users…</div>
                  ) : usersError ? (
                    <div className="px-4 py-4 text-sm text-red-600 dark:text-red-400">{usersError}</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">No users found.</div>
                  ) : (
                    <ul className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredUsers.map(u => (
                        <li key={u.id}>
                          <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(u.id)}
                              onChange={() => toggleUser(u.id)}
                              className="accent-indigo-600 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-sm text-gray-900 dark:text-white truncate">
                                {u.full_name ?? u.email}
                              </div>
                              {u.full_name && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                              )}
                            </div>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedIds.size} user{selectedIds.size === 1 ? '' : 's'} selected
                </p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Subject / Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. New feature: Recurring invoices 🎉"
              className={inputCls}
            />
          </div>

          {/* Body */}
          <div>
            <label className={labelCls}>Body</label>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">Use double line breaks for new paragraphs.</p>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={12}
              placeholder={"We've been building something big...\n\nStarting today, you can set up invoices that send automatically every month — no manual work required.\n\nGo check it out."}
              className={textareaCls}
            />
          </div>

          {error && (
            <div className="text-sm px-4 py-3 rounded-lg border bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {result && (
            <div className="text-sm px-4 py-3 rounded-lg border bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
              Sent to <strong>{result.sent.toLocaleString()}</strong> users.{result.skipped > 0 && ` ${result.skipped} skipped (opted out).`}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="text-sm bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {sendLabel}
            </button>
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="p-6">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Email Preview</p>
            <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden text-sm shadow-sm">
              <div style={{ background: '#111827', padding: '24px 28px' }}>
                <p style={{ margin: 0, color: '#ffffff', fontSize: '20px', fontWeight: 700 }}>BillByDab</p>
                <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '12px' }}>Built in Lagos. Free everywhere.</p>
              </div>
              <div style={{ padding: '28px', background: '#ffffff' }}>
                <p style={{ margin: '0 0 16px', color: '#111827', fontSize: '14px', lineHeight: 1.6 }}>
                  Hey [First name],
                </p>
                {previewParagraphs.map((para, i) => (
                  <p
                    key={i}
                    style={{ margin: '0 0 14px', color: '#374151', fontSize: '14px', lineHeight: 1.75 }}
                    dangerouslySetInnerHTML={{ __html: para || '&nbsp;' }}
                  />
                ))}
                <div style={{ margin: '24px 0 28px' }}>
                  <span style={{ display: 'inline-block', background: '#111827', color: '#fff', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
                    See What&apos;s New →
                  </span>
                </div>
                <p style={{ margin: 0, color: '#374151', fontSize: '14px', lineHeight: 1.8 }}>
                  With love from Lagos,<br />
                  <strong>Dab</strong>
                </p>
              </div>
              <div style={{ padding: '16px 28px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', textAlign: 'center' }}>
                <p style={{ margin: 0, color: '#9ca3af', fontSize: '11px' }}>
                  © {new Date().getFullYear()} BillByDab · <span style={{ color: '#9ca3af' }}>Unsubscribe</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
