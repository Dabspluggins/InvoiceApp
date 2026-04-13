'use client'

import { useState } from 'react'

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

const subjects = [
  'General Enquiry',
  'Billing',
  'Bug Report',
  'Feature Request',
]

export default function ContactClient() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState(subjects[0])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      })
      const json = await res.json()
      if (!res.ok) {
        setResult({ type: 'error', text: json.error || 'Something went wrong. Please try again.' })
      } else {
        setResult({ type: 'success', text: "Thanks! We'll get back to you within 24 hours." })
        setName('')
        setEmail('')
        setSubject(subjects[0])
        setMessage('')
      }
    } catch {
      setResult({ type: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="bg-white dark:bg-gray-900 min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Heading */}
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Get in Touch</h1>
          <p className="text-gray-500 dark:text-gray-400">We respond within 24 hours, Monday to Sunday.</p>
        </div>

        {/* Form card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputCls}
              >
                {subjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we help?"
                required
                rows={5}
                className={`${inputCls} resize-none`}
              />
            </div>

            {result && (
              <div
                className={`text-sm px-4 py-3 rounded-lg border ${
                  result.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}
              >
                {result.text}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>

        {/* Prefer email */}
        <div className="mt-8 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span>
            Prefer email?{' '}
            <a
              href="mailto:support@billbydab.com"
              className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              support@billbydab.com
            </a>
          </span>
        </div>
      </div>
    </main>
  )
}
