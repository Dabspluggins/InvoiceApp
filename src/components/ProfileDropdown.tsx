'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  profile_picture_url: string | null
  brand_color: string | null
  dashboard_theme: string | null
  logo_url: string | null
  business_name: string | null
}

export const THEME_OPTIONS = [
  { name: 'Indigo', value: 'indigo', color: '#4F46E5' },
  { name: 'Violet', value: 'violet', color: '#7C3AED' },
  { name: 'Rose', value: 'rose', color: '#E11D48' },
  { name: 'Amber', value: 'amber', color: '#D97706' },
  { name: 'Teal', value: 'teal', color: '#0D9488' },
  { name: 'Sky', value: 'sky', color: '#0284C7' },
  { name: 'Emerald', value: 'emerald', color: '#10B981' },
  { name: 'Orange', value: 'orange', color: '#F97316' },
  { name: 'Slate', value: 'slate', color: '#64748B' },
]

function applyThemeCssVars(color: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--dashboard-accent', color)
  }
}

function getInitials(user: User): string {
  const fullName = (user.user_metadata?.full_name || '') as string
  if (fullName.trim()) {
    const parts = fullName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (user.email || 'U').slice(0, 2).toUpperCase()
}

interface ProfileDropdownProps {
  user: User
  darkMode: boolean
  setDarkMode: (v: boolean) => void
  onThemeChange?: (color: string) => void
}

export default function ProfileDropdown({ user, darkMode, setDarkMode, onThemeChange }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<Profile>({
    profile_picture_url: null,
    brand_color: '#4F46E5',
    dashboard_theme: 'indigo',
    logo_url: null,
    business_name: null,
  })
  const [brandColorInput, setBrandColorInput] = useState('#4F46E5')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; label: string; details: string }>>([])
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingPayment, setEditingPayment] = useState<{ id: string; label: string; details: string } | null>(null)
  const [pmLabel, setPmLabel] = useState('')
  const [pmDetails, setPmDetails] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  async function loadProfile() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('profile_picture_url, brand_color, dashboard_theme, logo_url, business_name, payment_methods')
      .eq('id', user.id)
      .maybeSingle()

    if (data) {
      const loaded: Profile = {
        profile_picture_url: data.profile_picture_url || null,
        brand_color: data.brand_color || '#4F46E5',
        dashboard_theme: data.dashboard_theme || 'indigo',
        logo_url: data.logo_url || null,
        business_name: data.business_name || null,
      }
      setProfile(loaded)
      setBrandColorInput(loaded.brand_color || '#4F46E5')
      const themeColor = THEME_OPTIONS.find((t) => t.value === loaded.dashboard_theme)?.color || '#4F46E5'
      applyThemeCssVars(themeColor)
      onThemeChange?.(themeColor)
      const methods = (data.payment_methods as Array<{ id: string; label: string; details: string }>) || []
      setPaymentMethods(methods)
    }
  }

  async function upsertProfile(updates: Partial<Profile>) {
    const supabase = createClient()
    await supabase.from('profiles').upsert({ id: user.id, ...updates })
    setProfile((prev) => ({ ...prev, ...updates }))
    if (updates.dashboard_theme) {
      const themeColor = THEME_OPTIONS.find((t) => t.value === updates.dashboard_theme)?.color || '#4F46E5'
      applyThemeCssVars(themeColor)
      onThemeChange?.(themeColor)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = urlData.publicUrl + `?t=${Date.now()}`
      await upsertProfile({ profile_picture_url: url })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${user.id}/logo.${ext}`
      const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const url = urlData.publicUrl + `?t=${Date.now()}`
      await upsertProfile({ logo_url: url })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  async function savePaymentMethod() {
    if (!pmLabel.trim() || !pmDetails.trim()) return
    let updated
    if (editingPayment) {
      updated = paymentMethods.map((m) =>
        m.id === editingPayment.id ? { ...m, label: pmLabel, details: pmDetails } : m
      )
    } else {
      if (paymentMethods.length >= 3) return
      updated = [...paymentMethods, { id: crypto.randomUUID(), label: pmLabel, details: pmDetails }]
    }
    setPaymentMethods(updated)
    const supabase = createClient()
    await supabase.from('profiles').upsert({ id: user.id, payment_methods: updated })
    setShowPaymentForm(false)
    setEditingPayment(null)
    setPmLabel('')
    setPmDetails('')
  }

  async function deletePaymentMethod(id: string) {
    const updated = paymentMethods.filter((m) => m.id !== id)
    setPaymentMethods(updated)
    const supabase = createClient()
    await supabase.from('profiles').upsert({ id: user.id, payment_methods: updated })
  }

  const initials = getInitials(user)
  const brandColorForAvatar = profile.brand_color || '#4F46E5'
  const currentTheme = THEME_OPTIONS.find((t) => t.value === profile.dashboard_theme) || THEME_OPTIONS[0]
  const displayName = (profile.business_name || (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'User')

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden border-2 shadow-sm hover:shadow-md transition focus:outline-none"
        style={{ borderColor: currentTheme.color }}
        title="Profile & Settings"
      >
        {profile.profile_picture_url ? (
          <img src={profile.profile_picture_url} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span
            className="w-full h-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: brandColorForAvatar }}
          >
            {initials}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">

          {/* Section 1: Identity */}
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shrink-0 border-2"
                style={{ borderColor: brandColorForAvatar }}
              >
                {profile.profile_picture_url ? (
                  <img src={profile.profile_picture_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: brandColorForAvatar }}
                  >
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="w-full text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 rounded-lg py-1.5 transition disabled:opacity-50"
            >
              {uploadingAvatar ? 'Uploading…' : 'Upload Photo'}
            </button>
          </div>

          {/* Section 2: Brand */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Brand</p>

            {/* Brand Color */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700 font-medium w-24 shrink-0">Brand Color</label>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="color"
                  value={brandColorInput}
                  onChange={(e) => setBrandColorInput(e.target.value)}
                  onBlur={(e) => upsertProfile({ brand_color: e.target.value })}
                  className="w-8 h-7 rounded cursor-pointer border border-gray-200 p-0.5"
                />
                <input
                  type="text"
                  value={brandColorInput}
                  onChange={(e) => {
                    setBrandColorInput(e.target.value)
                    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                      upsertProfile({ brand_color: e.target.value })
                    }
                  }}
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Business Logo */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700 font-medium w-24 shrink-0">Business Logo</label>
              <div className="flex items-center gap-2 flex-1">
                {profile.logo_url && (
                  <img src={profile.logo_url} alt="Logo" className="w-8 h-8 object-contain rounded border border-gray-200" />
                )}
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 rounded-lg px-3 py-1.5 transition disabled:opacity-50"
                >
                  {uploadingLogo ? 'Uploading…' : profile.logo_url ? 'Change Logo' : 'Upload Logo'}
                </button>
              </div>
            </div>

            {/* Dashboard Accent */}
            <div>
              <label className="text-xs text-gray-700 font-medium block mb-2">Dashboard Accent</label>
              <div className="flex flex-wrap gap-2">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    title={t.name}
                    onClick={() => upsertProfile({ dashboard_theme: t.value })}
                    className="w-6 h-6 rounded-full transition"
                    style={{
                      backgroundColor: t.color,
                      outline: profile.dashboard_theme === t.value ? `3px solid ${t.color}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Payment Details */}
          <div className="px-5 py-4 border-b border-gray-100 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Payment Details</p>

            {paymentMethods.map((m) => (
              <div
                key={m.id}
                className="flex items-start justify-between bg-gray-50 rounded-lg p-2 border border-gray-200"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{m.label}</p>
                  <p className="text-xs text-gray-500 truncate">{m.details.split('\n')[0]}</p>
                </div>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditingPayment(m)
                      setPmLabel(m.label)
                      setPmDetails(m.details)
                      setShowPaymentForm(true)
                    }}
                    className="p-1 text-gray-400 hover:text-indigo-600"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deletePaymentMethod(m.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {showPaymentForm ? (
              <div className="space-y-1.5">
                <input
                  value={pmLabel}
                  onChange={(e) => setPmLabel(e.target.value)}
                  placeholder="Label (e.g. GTBank, Opay)"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <textarea
                  value={pmDetails}
                  onChange={(e) => setPmDetails(e.target.value)}
                  placeholder={"Account Name: ...\nAccount No: ...\nBank: ..."}
                  rows={3}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={savePaymentMethod}
                    className="flex-1 text-xs bg-indigo-600 text-white rounded-lg py-1.5 hover:bg-indigo-700 transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setShowPaymentForm(false)
                      setEditingPayment(null)
                      setPmLabel('')
                      setPmDetails('')
                    }}
                    className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { if (paymentMethods.length < 3) setShowPaymentForm(true) }}
                disabled={paymentMethods.length >= 3}
                className={`text-xs font-medium ${paymentMethods.length >= 3 ? 'text-gray-300 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-800'}`}
              >
                {paymentMethods.length >= 3 ? '✓ Maximum 3 saved' : '+ Add Payment Method'}
              </button>
            )}
          </div>

          {/* Section 4: Preferences */}
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Dark Mode</span>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`relative w-9 h-5 rounded-full transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${darkMode ? 'translate-x-4' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* Section 5: Actions */}
          <div className="px-5 py-3 flex items-center gap-3">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex-1 text-center text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg py-1.5 transition"
            >
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex-1 text-center text-xs font-medium text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 rounded-lg py-1.5 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
