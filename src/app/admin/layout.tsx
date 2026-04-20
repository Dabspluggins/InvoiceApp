import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-8 flex items-center gap-6 py-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Admin
          </span>
          <Link
            href="/admin/announcements"
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Announcements
          </Link>
          <Link
            href="/admin/segments"
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Segments
          </Link>
        </div>
      </nav>
      {children}
    </>
  )
}
