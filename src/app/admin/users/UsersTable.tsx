'use client'

import { useEffect, useState } from 'react'

type User = {
  id: string
  email: string
  name: string | null
  created_at: string
  email_updates: boolean | null
}

const TABS = ['All', 'Opted in', 'Opted out'] as const
type Tab = (typeof TABS)[number]

export default function UsersTable() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('All')

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setUsers(data.users)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users
    .filter(u => {
      if (tab === 'Opted in') return u.email_updates === true
      if (tab === 'Opted out') return u.email_updates !== true
      return true
    })
    .filter(u => {
      const q = search.toLowerCase()
      if (!q) return true
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name?.toLowerCase().includes(q) ?? false)
      )
    })

  const total = users.length
  const optedIn = users.filter(u => u.email_updates === true).length
  const optedOut = total - optedIn

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {loading ? (
          <div className="h-5 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ) : (
          <span>
            <strong className="text-gray-900 dark:text-white">{total.toLocaleString()}</strong> users total ·{' '}
            <strong className="text-green-600 dark:text-green-400">{optedIn.toLocaleString()}</strong> opted in ·{' '}
            <strong className="text-gray-500 dark:text-gray-400">{optedOut.toLocaleString()}</strong> opted out
          </span>
        )}
      </div>

      {/* Search & filter tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
        />
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">Joined</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Email Updates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></td>
                      <td className="px-6 py-4"><div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" /></td>
                    </tr>
                  ))
                : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No users match your filter.
                    </td>
                  </tr>
                )
                : filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                      {u.name ?? <span className="text-gray-400 dark:text-gray-500 font-normal">—</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{u.email}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4">
                      {u.email_updates === true ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                          Opted in
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                          Opted out
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
