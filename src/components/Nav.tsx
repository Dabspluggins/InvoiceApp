import Link from 'next/link'

export default function Nav() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-indigo-600">InvoiceFree</span>
          </Link>

          {/* Center links */}
          <div className="hidden sm:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Home
            </Link>
            <Link href="/invoice" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Invoice Generator
            </Link>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-4 py-1.5 rounded-lg"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
