'use client'

import { useState } from 'react'

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
const textareaCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition resize-none'
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

export default function AnnouncementComposer() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.')
      return
    }
    setSending(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/admin/send-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send')
      setResult({ sent: json.sent, skipped: json.skipped })
      setTitle('')
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSending(false)
    }
  }

  const previewParagraphs = body
    .split(/\n\n+/)
    .map(para => para.replace(/\n/g, '<br>'))

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
              Sent to <strong>{result.sent.toLocaleString()}</strong> users. {result.skipped > 0 && `${result.skipped} skipped (opted out).`}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={sending || !title.trim() || !body.trim()}
              className="text-sm bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {sending ? 'Sending...' : 'Send to All Users'}
            </button>
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="p-6">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Email Preview</p>
            <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden text-sm shadow-sm">
              {/* Header */}
              <div style={{ background: '#111827', padding: '24px 28px' }}>
                <p style={{ margin: 0, color: '#ffffff', fontSize: '20px', fontWeight: 700 }}>BillByDab</p>
                <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '12px' }}>Built in Lagos. Free everywhere.</p>
              </div>
              {/* Body */}
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
              {/* Footer */}
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
