'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Draft } from '@/components/AnnouncementComposer'

interface Props {
  onEdit: (draft: Draft) => void
  refreshKey?: number
}

function formatScheduledTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'sending soon'
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `in ${hours}h ${minutes}m`
  return `in ${minutes}m`
}

function RecipientBadge({ mode }: { mode: string }) {
  const labels: Record<string, string> = { all: 'All users', specific: 'Specific users', segment: 'Segment' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
      {labels[mode] ?? mode}
    </span>
  )
}

function DraftCard({
  draft,
  onEdit,
  onSendNow,
  onDelete,
}: {
  draft: Draft
  onEdit: () => void
  onSendNow: () => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [countdown, setCountdown] = useState(() =>
    draft.scheduled_for ? formatCountdown(draft.scheduled_for) : ''
  )
  const [actioning, setActioning] = useState<'send' | 'delete' | null>(null)

  useEffect(() => {
    if (!draft.scheduled_for) return
    const interval = setInterval(() => {
      setCountdown(formatCountdown(draft.scheduled_for!))
    }, 60000)
    return () => clearInterval(interval)
  }, [draft.scheduled_for])

  const truncatedSubject = draft.subject
    ? draft.subject.length > 60
      ? draft.subject.slice(0, 60) + '…'
      : draft.subject
    : '(No subject)'

  return (
    <div className="px-5 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{truncatedSubject}</span>
          <RecipientBadge mode={draft.recipient_mode} />
        </div>
        {draft.scheduled_for ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sends {formatScheduledTime(draft.scheduled_for)} ·{' '}
            <span className="text-indigo-600 dark:text-indigo-400">{countdown}</span>
          </p>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Updated{' '}
            {new Date(draft.updated_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onEdit}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          Edit
        </button>
        <button
          onClick={async () => {
            setActioning('send')
            await onSendNow()
            setActioning(null)
          }}
          disabled={actioning !== null}
          className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium disabled:opacity-50"
        >
          {actioning === 'send' ? 'Sending…' : 'Send Now'}
        </button>
        <button
          onClick={async () => {
            setActioning('delete')
            await onDelete()
            setActioning(null)
          }}
          disabled={actioning !== null}
          className="text-xs text-red-500 dark:text-red-400 hover:underline font-medium disabled:opacity-50"
        >
          {actioning === 'delete' ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}

export default function DraftsPanel({ onEdit, refreshKey }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/drafts')
      const json = await res.json()
      setDrafts(json.drafts ?? [])
    } catch {
      // swallow — UI stays with stale data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts, refreshKey])

  async function handleSendNow(id: string) {
    const res = await fetch(`/api/admin/drafts/${id}/send`, { method: 'POST' })
    if (res.ok) {
      setDrafts(prev => prev.filter(d => d.id !== id))
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/drafts/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setDrafts(prev => prev.filter(d => d.id !== id))
    }
  }

  const scheduled = [...drafts.filter(d => d.status === 'scheduled')].sort(
    (a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime()
  )
  const draftItems = [...drafts.filter(d => d.status === 'draft')].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )

  const isEmpty = !loading && drafts.length === 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Drafts & Scheduled</h2>
        <button
          onClick={fetchDrafts}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">No drafts or scheduled sends.</div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {scheduled.length > 0 && (
            <>
              <div className="px-5 py-2 bg-gray-50 dark:bg-gray-900/40">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Scheduled
                </span>
              </div>
              {scheduled.map(draft => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  onEdit={() => onEdit(draft)}
                  onSendNow={() => handleSendNow(draft.id)}
                  onDelete={() => handleDelete(draft.id)}
                />
              ))}
            </>
          )}
          {draftItems.length > 0 && (
            <>
              <div className="px-5 py-2 bg-gray-50 dark:bg-gray-900/40">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Drafts
                </span>
              </div>
              {draftItems.map(draft => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  onEdit={() => onEdit(draft)}
                  onSendNow={() => handleSendNow(draft.id)}
                  onDelete={() => handleDelete(draft.id)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
