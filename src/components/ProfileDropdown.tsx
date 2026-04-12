'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { SavedPaymentMethod } from '@/lib/types'

export default function ProfileDropdown({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([])
  const [editingMethod, setEditingMethod] = useState<SavedPaymentMethod | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [formLabel, setFormLabel] = useState('')
  const [formDetails, setFormDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('logo_url, payment_methods')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setLogoUrl((data as { logo_url?: string | null }).logo_url ?? null)
        const pm = (data as { payment_methods?: unknown }).payment_methods
        setPaymentMethods(Array.isArray(pm) ? (pm as SavedPaymentMethod[]) : [])
      })
  }, [open, user.id])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${user.id}/profile.${ext}`
      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const url = urlData.publicUrl
      await supabase.from('profiles').upsert({ id: user.id, logo_url: url })
      setLogoUrl(url)
    } finally {
      setLogoUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function persistMethods(methods: SavedPaymentMethod[]) {
    const supabase = createClient()
    await supabase.from('profiles').upsert({ id: user.id, payment_methods: methods })
    setPaymentMethods(methods)
  }

  async function handleSaveMethod() {
    if (!formLabel.trim() || !formDetails.trim()) return
    setSaving(true)
    try {
      let updated: SavedPaymentMethod[]
      if (editingMethod) {
        updated = paymentMethods.map((m) =>
          m.id === editingMethod.id
            ? { ...m, label: formLabel.trim(), details: formDetails.trim() }
            : m
        )
      } else {
        updated = [
          ...paymentMethods,
          { id: crypto.randomUUID(), label: formLabel.trim(), details: formDetails.trim() },
        ]
      }
      await persistMethods(updated)
      cancelForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await persistMethods(paymentMethods.filter((m) => m.id !== id))
  }

  function startEdit(method: SavedPaymentMethod) {
    setEditingMethod(method)
    setAddingNew(false)
    setFormLabel(method.label)
    setFormDetails(method.details)
  }

  function startAdd() {
    setAddingNew(true)
    setEditingMethod(null)
    setFormLabel('')
    setFormDetails('')
  }

  function cancelForm() {
    setAddingNew(false)
    setEditingMethod(null)
    setFormLabel('')
    setFormDetails('')
  }

  const showForm = addingNew || editingMethod !== null
  const initials =
    ((user.user_metadata?.full_name as string | undefined)?.[0]?.toUpperCase()) ||
    user.email?.[0]?.toUpperCase() ||
    '?'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center hover:bg-indigo-700 transition"
        aria-label="Open profile menu"
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {(user.user_metadata?.full_name as string | undefined) || user.email}
            </p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>

          {/* Logo Upload */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Profile Logo</p>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-10 w-auto object-contain rounded border border-gray-200 p-0.5"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={logoUploading}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
                  >
                    {logoUploading ? 'Uploading…' : 'Change'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={logoUploading}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium border border-dashed border-indigo-300 rounded-lg px-3 py-1.5 hover:border-indigo-400 transition disabled:opacity-50"
                >
                  {logoUploading ? 'Uploading…' : '+ Upload Logo'}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>

          {/* Payment Details */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Payment Details</p>

            {paymentMethods.length === 0 && !showForm && (
              <p className="text-xs text-gray-400 mb-2">No saved payment methods yet</p>
            )}

            {/* Saved method cards */}
            <div className="space-y-2 mb-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="bg-gray-50 rounded-lg p-2 border border-gray-200 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{method.label}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {method.details.length > 40
                        ? method.details.slice(0, 40) + '…'
                        : method.details.split('\n')[0]}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(method)}
                      className="p-1 text-gray-400 hover:text-indigo-600 rounded transition"
                      aria-label="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(method.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition"
                      aria-label="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Inline add/edit form */}
            {showForm && (
              <div className="space-y-2 mb-2">
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. GTBank, Opay, USD Account"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <textarea
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                  placeholder={"Account Name: ...\nAccount No: ...\nBank: ..."}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveMethod}
                    disabled={saving || !formLabel.trim() || !formDetails.trim()}
                    className="flex-1 text-xs font-medium bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={cancelForm}
                    className="flex-1 text-xs font-medium border border-gray-200 text-gray-600 py-1.5 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Add button */}
            {!showForm && (
              <button
                onClick={paymentMethods.length >= 3 ? undefined : startAdd}
                disabled={paymentMethods.length >= 3}
                className={`text-sm font-medium transition ${
                  paymentMethods.length >= 3
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-indigo-600 hover:text-indigo-700'
                }`}
              >
                {paymentMethods.length >= 3 ? 'Maximum 3 payment methods' : '+ Add Payment Method'}
              </button>
            )}
          </div>

          {/* Settings + Sign Out */}
          <div className="px-2 py-2">
            <Link
              href="/settings"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition"
              onClick={() => setOpen(false)}
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </Link>
            <button
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                setOpen(false)
                router.push('/')
                router.refresh()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition text-left"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
