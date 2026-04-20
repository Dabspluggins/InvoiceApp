'use client'

import { useState, useEffect } from 'react'

type Segment = {
  id: string
  name: string
  rules: { field: string; operator: string; value: string | number | boolean }[]
}

type RecipientMode = 'all' | 'specific' | 'segment'

export type Draft = {
  id: string
  subject: string
  body_html: string
  body_text: string
  recipient_mode: 'all' | 'specific' | 'segment'
  recipient_ids: unknown[]
  segment_id: string | null
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  scheduled_for: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
const textareaCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition resize-none'
const selectCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

interface Props {
  draft?: Draft | null
  onDraftSaved?: () => void
}

export default function AnnouncementComposer({ draft, onDraftSaved }: Props) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  // Recipient mode
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all')
  const [specificEmails, setSpecificEmails] = useState('')

  // Segment mode
  const [segments, setSegments] = useState<Segment[]>([])
  const [segmentsLoaded, setSegmentsLoaded] = useState(false)
  const [loadingSegments, setLoadingSegments] = useState(false)
  const [selectedSegmentId, setSelectedSegmentId] = useState('')
  const [segmentPreview, setSegmentPreview] = useState<{ count: number; userIds: string[] } | null>(null)
  const [previewingSegment, setPreviewingSegment] = useState(false)

  // Draft / Schedule
  const [draftId, setDraftId] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')

  async function fetchSegments() {
    if (segmentsLoaded) return
    setLoadingSegments(true)
    try {
      const res = await fetch('/api/admin/segments')
      if (res.ok) {
        const data: Segment[] = await res.json()
        setSegments(data)
        setSegmentsLoaded(true)
      }
    } catch {
      // ignore
    } finally {
      setLoadingSegments(false)
    }
  }

  async function previewSegment(segmentId: string) {
    const seg = segments.find(s => s.id === segmentId)
    if (!seg) return
    setPreviewingSegment(true)
    setSegmentPreview(null)
    try {
      const res = await fetch('/api/admin/segments/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: seg.rules }),
      })
      if (res.ok) {
        const data = await res.json()
        setSegmentPreview(data as { count: number; userIds: string[] })
      }
    } catch {
      // ignore
    } finally {
      setPreviewingSegment(false)
    }
  }

  function handleModeChange(mode: RecipientMode) {
    setRecipientMode(mode)
    setError(null)
    setResult(null)
    if (mode === 'segment') fetchSegments()
  }

  useEffect(() => {
    if (selectedSegmentId) previewSegment(selectedSegmentId)
    else setSegmentPreview(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegmentId])

  useEffect(() => {
    if (draft) {
      setTitle(draft.subject)
      setBody(draft.body_text)
      setDraftId(draft.id)
      if (draft.scheduled_for) {
        const dt = new Date(draft.scheduled_for)
        const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
        setScheduledFor(local)
        setShowSchedule(true)
      } else {
        setScheduledFor('')
        setShowSchedule(false)
      }
      setResult(null)
      setError(null)
      setDraftSaved(false)
    } else {
      setTitle('')
      setBody('')
      setDraftId(null)
      setScheduledFor('')
      setShowSchedule(false)
      setResult(null)
      setError(null)
      setDraftSaved(false)
    }
  }, [draft])

  function buildBodyHtml(text: string): string {
    return text
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('')
  }

  async function handleSaveDraft() {
    if (!title.trim() && !body.trim()) {
      setError('Add a subject or body before saving.')
      return
    }
    setSavingDraft(true)
    setError(null)
    setDraftSaved(false)

    try {
      const payload = {
        subject: title.trim(),
        body_html: buildBodyHtml(body),
        body_text: body.trim(),
        recipient_mode: 'all',
        status: 'draft',
        scheduled_for: null,
      }

      let res: Response
      if (draftId) {
        res = await fetch(`/api/admin/drafts/${draftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/admin/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save draft')

      if (!draftId) setDraftId(json.draft.id)
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 3000)
      onDraftSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft')
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleScheduleSend() {
    if (!title.trim() || !body.trim()) {
      setError('Subject and body are required.')
      return
    }
    if (!scheduledFor) {
      setError('Please set a date and time to schedule.')
      return
    }
    setSavingDraft(true)
    setError(null)

    try {
      const payload = {
        subject: title.trim(),
        body_html: buildBodyHtml(body),
        body_text: body.trim(),
        recipient_mode: 'all',
        status: 'scheduled',
        scheduled_for: new Date(scheduledFor).toISOString(),
      }

      let res: Response
      if (draftId) {
        res = await fetch(`/api/admin/drafts/${draftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/admin/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to schedule')

      if (!draftId) setDraftId(json.draft.id)
      setDraftSaved(true)
      setTimeout(() => setDraftSaved(false), 3000)
      onDraftSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule')
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.')
      return
    }

    const payload: Record<string, unknown> = {
      title: title.trim(),
      body: body.trim(),
    }

    if (recipientMode === 'specific') {
      const emails = specificEmails.split(/[\n,]/).map(e => e.trim()).filter(Boolean)
      if (emails.length === 0) {
        setError('Enter at least one email address.')
        return
      }
      payload.recipientEmails = emails
    } else if (recipientMode === 'segment') {
      if (!selectedSegmentId) {
        setError('Select a segment.')
        return
      }
      if (!segmentPreview) {
        setError('Wait for segment preview to load.')
        return
      }
      payload.recipientIds = segmentPreview.userIds
    }

    setSending(true)
    setError(null)
    setResult(null)

    try {
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
      setSpecificEmails('')
      setSelectedSegmentId('')
      setSegmentPreview(null)
      setDraftId(null)
      setScheduledFor('')
      setShowSchedule(false)
      onDraftSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  const sendLabel = sending
    ? 'Sending…'
    : recipientMode === 'all'
    ? 'Send to All Users'
    : recipientMode === 'specific'
    ? 'Send to Specific Users'
    : 'Send to Segment'

  const canSend =
    !sending &&
    title.trim() !== '' &&
    body.trim() !== '' &&
    (recipientMode !== 'segment' || Boolean(segmentPreview))

  const isScheduled = showSchedule && !!scheduledFor

  const previewParagraphs = body
    .split(/\n\n+/)
    .map(para => para.replace(/\n/g, '<br>'))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {draftId ? 'Edit Draft' : 'Compose Announcement'}
        </h2>
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
          {/* Recipient mode selector */}
          <div>
            <label className={labelCls}>Send to</label>
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg w-fit">
              {(
                [
                  { value: 'all', label: 'All opted-in users' },
                  { value: 'specific', label: 'Specific users' },
                  { value: 'segment', label: 'Segment' },
                ] as { value: RecipientMode; label: string }[]
              ).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleModeChange(opt.value)}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                    recipientMode === opt.value
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Specific users — email list */}
          {recipientMode === 'specific' && (
            <div>
              <label className={labelCls}>Email addresses</label>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                Comma- or line-separated. Only opted-in users will be emailed.
              </p>
              <textarea
                value={specificEmails}
                onChange={e => setSpecificEmails(e.target.value)}
                rows={4}
                placeholder={'user@example.com\nanother@example.com'}
                className={textareaCls}
              />
            </div>
          )}

          {/* Segment selector */}
          {recipientMode === 'segment' && (
            <div>
              <label className={labelCls}>Segment</label>
              {loadingSegments ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">Loading segments…</p>
              ) : segments.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  No segments yet.{' '}
                  <a href="/admin/segments" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    Create one
                  </a>
                </p>
              ) : (
                <>
                  <select
                    value={selectedSegmentId}
                    onChange={e => setSelectedSegmentId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select a segment…</option>
                    {segments.map(seg => (
                      <option key={seg.id} value={seg.id}>{seg.name}</option>
                    ))}
                  </select>
                  {selectedSegmentId && (
                    <p className="text-xs mt-1.5 text-gray-500 dark:text-gray-400">
                      {previewingSegment
                        ? 'Counting users…'
                        : segmentPreview
                        ? `${segmentPreview.count.toLocaleString()} users in this segment (opted-in users will be emailed)`
                        : null}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

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

          {showSchedule && (
            <div>
              <label className={labelCls}>Schedule Date & Time</label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className={inputCls}
              />
            </div>
          )}

          {error && (
            <div className="text-sm px-4 py-3 rounded-lg border bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {draftSaved && (
            <div className="text-sm px-4 py-3 rounded-lg border bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
              {isScheduled ? 'Scheduled successfully.' : 'Draft saved.'}
            </div>
          )}

          {result && (
            <div className="text-sm px-4 py-3 rounded-lg border bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
              Sent to <strong>{result.sent.toLocaleString()}</strong> users.{result.skipped > 0 && ` ${result.skipped} skipped (opted out).`}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSaveDraft}
              disabled={savingDraft || sending}
              className="text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {savingDraft && !isScheduled ? 'Saving...' : 'Save Draft'}
            </button>

            <button
              onClick={() => setShowSchedule(s => !s)}
              disabled={sending}
              className={`text-sm px-4 py-2.5 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                showSchedule
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Schedule {showSchedule ? '▲' : '▾'}
            </button>

            <div className="flex-1" />

            {isScheduled ? (
              <button
                onClick={handleScheduleSend}
                disabled={savingDraft || sending}
                className="text-sm bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {savingDraft ? 'Scheduling...' : 'Schedule Send'}
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="text-sm bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {sendLabel}
              </button>
            )}
          </div>
        </div>

        {/* Email preview panel */}
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
