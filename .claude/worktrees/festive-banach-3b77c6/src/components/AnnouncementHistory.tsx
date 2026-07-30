'use client'

import { useEffect, useState } from 'react'

type AnnouncementLog = {
  id: string
  subject: string
  body_preview: string | null
  recipient_count: number
  audience_type: string
  sent_at: string
  sent_by: string | null
  delivered_count: number
  opened_count: number
  clicked_count: number
  bounced_count: number
}

function openRate(log: AnnouncementLog): string {
  if (log.delivered_count === 0) return '—'
  return (log.opened_count / log.delivered_count * 100).toFixed(1) + '%'
}

export default function AnnouncementHistory() {
  const [logs, setLogs] = useState<AnnouncementLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/announcements')
      .then(r => r.json())
      .then(d => setLogs(d.announcements ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalDelivered = logs.reduce((sum, l) => sum + l.delivered_count, 0)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Announcement History</h2>
        {!loading && logs.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {logs.length} sent &middot; {totalDelivered.toLocaleString()} total emails delivered
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse flex gap-4 items-center">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-14" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-14" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-14" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-14" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 ml-auto" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 dark:text-gray-400">No announcements sent yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Subject</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Recipients</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Delivered</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Opened</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Clicks</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-medium max-w-xs truncate">{log.subject}</td>
                  <td className="px-6 py-4 text-right text-gray-900 dark:text-white">{log.recipient_count.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-gray-900 dark:text-white">{log.delivered_count.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-900 dark:text-white">{log.opened_count.toLocaleString()}</span>
                    <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">({openRate(log)})</span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900 dark:text-white">{log.clicked_count.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(log.sent_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
