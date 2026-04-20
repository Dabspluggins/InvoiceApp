'use client'

import { useState } from 'react'
import AnnouncementComposer, { type Draft } from '@/components/AnnouncementComposer'
import DraftsPanel from './DraftsPanel'

type Announcement = {
  id: string
  title: string
  body: string
  sent_at: string
  sent_by: string | null
  recipient_count: number
}

interface Props {
  announcements: Announcement[]
}

export default function AnnouncementsClient({ announcements }: Props) {
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  function handleDraftSaved() {
    setSelectedDraft(null)
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="space-y-8">
      <AnnouncementComposer
        draft={selectedDraft}
        onDraftSaved={handleDraftSaved}
      />

      <DraftsPanel
        onEdit={(draft) => {
          setSelectedDraft(draft)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        refreshKey={refreshKey}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Sent Announcements</h2>
        </div>
        {announcements.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">No announcements sent yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Title
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-right">
                    Recipients
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {announcements.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-medium max-w-xs truncate">
                      {a.title}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(a.sent_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900 dark:text-white font-medium">
                      {a.recipient_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
