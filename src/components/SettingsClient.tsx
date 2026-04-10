'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
const textareaCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition resize-none'

export default function SettingsClient({ user }: { user: User }) {
  const router = useRouter()
  const supabase = createClient()

  // Profile section
  const [displayName, setDisplayName] = useState(
    (user.user_metadata?.full_name as string) || ''
  )
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Email section
  const [newEmail, setNewEmail] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Password section
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Invoice Defaults section
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(0)
  const [defaultNotes, setDefaultNotes] = useState('')
  const [defaultTerms, setDefaultTerms] = useState('')
  const [defaultsSaving, setDefaultsSaving] = useState(false)
  const [defaultsMsg, setDefaultsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const supabaseClient = createClient()
    supabaseClient
      .from('profiles')
      .select('default_tax_rate, default_notes, default_terms')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.default_tax_rate != null) setDefaultTaxRate(Number(data.default_tax_rate))
        if (data?.default_notes != null) setDefaultNotes(data.default_notes)
        if (data?.default_terms != null) setDefaultTerms(data.default_terms)
      })
  }, [user.id])

  async function saveInvoiceDefaults(e: React.FormEvent) {
    e.preventDefault()
    setDefaultsSaving(true)
    setDefaultsMsg(null)
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        default_tax_rate: defaultTaxRate,
        default_notes: defaultNotes || null,
        default_terms: defaultTerms || null,
      }, { onConflict: 'id' })
    setDefaultsSaving(false)
    if (error) {
      setDefaultsMsg({ type: 'error', text: error.message })
    } else {
      setDefaultsMsg({ type: 'success', text: 'Invoice defaults saved.' })
    }
  }

  // Danger zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } })
    setProfileSaving(false)
    if (error) {
      setProfileMsg({ type: 'error', text: error.message })
    } else {
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' })
    }
  }

  async function updateEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailMsg(null)
    if (!newEmail.trim()) {
      setEmailMsg({ type: 'error', text: 'Please enter a new email address.' })
      return
    }
    if (newEmail.trim() === user.email) {
      setEmailMsg({ type: 'error', text: 'New email must be different from your current email.' })
      return
    }
    setEmailSaving(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailSaving(false)
    if (error) {
      setEmailMsg({ type: 'error', text: error.message })
    } else {
      setEmailMsg({ type: 'success', text: `Confirmation email sent to ${newEmail.trim()}. Please click the link in that email to complete the change.` })
      setNewEmail('')
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters.' })
      return
    }
    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)
    if (error) {
      setPasswordMsg({ type: 'error', text: error.message })
    } else {
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function deleteAccount() {
    if (deleteInput !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/settings/delete-account', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete account')
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your profile and account preferences</p>
      </div>

      {/* Profile section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Profile</h2>
        </div>
        <form onSubmit={saveProfile} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Email address</label>
            <div className="w-full border border-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-500 bg-gray-50">
              {user.email}
            </div>
          </div>
          <div>
            <label className={labelCls}>Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className={inputCls}
            />
          </div>
          {profileMsg && (
            <div
              className={`text-sm px-4 py-3 rounded-lg border ${
                profileMsg.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {profileMsg.text}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileSaving}
              className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Update Email section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Update Email</h2>
        </div>
        <form onSubmit={updateEmail} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Current email address</label>
            <div className="w-full border border-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-500 bg-gray-50">
              {user.email}
            </div>
          </div>
          <div>
            <label className={labelCls}>New email address</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@example.com"
              className={inputCls}
            />
          </div>
          {emailMsg && (
            <div
              className={`text-sm px-4 py-3 rounded-lg border ${
                emailMsg.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {emailMsg.text}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={emailSaving}
              className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {emailSaving ? 'Sending...' : 'Update Email'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
        </div>
        <form onSubmit={changePassword} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>
          {passwordMsg && (
            <div
              className={`text-sm px-4 py-3 rounded-lg border ${
                passwordMsg.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {passwordMsg.text}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordSaving}
              className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Invoice Defaults section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Invoice Defaults</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pre-fill new invoices with these values</p>
        </div>
        <form onSubmit={saveInvoiceDefaults} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Default tax rate (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={defaultTaxRate}
              onChange={(e) => setDefaultTaxRate(Number(e.target.value))}
              placeholder="0"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Default notes</label>
            <textarea
              value={defaultNotes}
              onChange={(e) => setDefaultNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Thank you for your business!"
              className={textareaCls}
            />
          </div>
          <div>
            <label className={labelCls}>Default terms</label>
            <textarea
              value={defaultTerms}
              onChange={(e) => setDefaultTerms(e.target.value)}
              rows={3}
              placeholder="e.g. Payment due within 30 days. Late payments subject to 1.5% monthly interest."
              className={textareaCls}
            />
          </div>
          {defaultsMsg && (
            <div
              className={`text-sm px-4 py-3 rounded-lg border ${
                defaultsMsg.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {defaultsMsg.text}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={defaultsSaving}
              className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {defaultsSaving ? 'Saving...' : 'Save Defaults'}
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50">
          <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-red-600 border border-red-300 px-5 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete Account
            </button>
          ) : (
            <div className="space-y-3 border border-red-200 rounded-lg p-4 bg-red-50">
              <p className="text-sm font-medium text-red-700">
                Type <strong>DELETE</strong> to confirm account deletion:
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                className="w-full border border-red-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 transition"
              />
              {deleteError && (
                <p className="text-sm text-red-600">{deleteError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteInput('')
                    setDeleteError(null)
                  }}
                  className="text-sm text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:border-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteAccount}
                  disabled={deleteInput !== 'DELETE' || deleting}
                  className="text-sm bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
