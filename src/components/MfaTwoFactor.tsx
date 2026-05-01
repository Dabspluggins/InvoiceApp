'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

type Step =
  | 'loading'
  | 'disabled'
  | 'enrolling-qr'
  | 'enrolling-verify'
  | 'backup-codes'
  | 'enabled'
  | 'disabling'

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition'
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

function generateBackupCodes(): string[] {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => {
    const seg = (n: number) => {
      const bytes = crypto.getRandomValues(new Uint8Array(n))
      return Array.from(bytes, b => chars[b & 31]).join('')
    }
    return `${seg(4)}-${seg(4)}`
  })
}

function Msg({ msg }: { msg: { type: 'success' | 'error'; text: string } | null }) {
  if (!msg) return null
  return (
    <div
      className={`text-sm px-4 py-3 rounded-lg border ${
        msg.type === 'success'
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-600 dark:text-red-400'
      }`}
    >
      {msg.text}
    </div>
  )
}

export default function MfaTwoFactor({ user }: { user: User }) {
  const supabase = createClient()
  const [step, setStep] = useState<Step>('loading')
  const [factorId, setFactorId] = useState('')
  const [qrSvg, setQrSvg] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [disableCode, setDisableCode] = useState('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { checkStatus() }, [])

  useEffect(() => {
    if (step === 'enrolling-verify' || step === 'disabling') {
      setTimeout(() => codeRef.current?.focus(), 50)
    }
  }, [step])

  async function checkStatus() {
    const { data } = await supabase.auth.mfa.listFactors()
    const verified = data?.totp?.find(f => f.status === 'verified')
    if (verified) {
      setFactorId(verified.id)
      setStep('enabled')
    } else {
      setStep('disabled')
    }
  }

  async function startEnrollment() {
    setMsg(null)
    setBusy(true)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    setBusy(false)
    if (error || !data) {
      setMsg({ type: 'error', text: error?.message ?? 'Failed to start setup' })
      return
    }
    setFactorId(data.id)
    setQrSvg(data.totp.qr_code)
    setSecret(data.totp.secret)
    setVerifyCode('')
    setStep('enrolling-qr')
  }

  async function verifyEnrollment() {
    if (verifyCode.length !== 6) return
    setMsg(null)
    setBusy(true)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: verifyCode })
      if (error) {
        setMsg({ type: 'error', text: 'Invalid code — please try again.' })
        setVerifyCode('')
        codeRef.current?.focus()
        return
      }
      const codes = generateBackupCodes()
      const res = await fetch('/api/mfa/backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes }),
      })
      if (!res.ok) {
        setMsg({ type: 'error', text: 'Failed to save backup codes — please try again.' })
        return
      }
      setBackupCodes(codes)
      setStep('backup-codes')
      setVerifyCode('')
      setMsg(null)
    } catch {
      setMsg({ type: 'error', text: 'Failed to save backup codes — please try again.' })
    } finally {
      setBusy(false)
    }
  }

  async function finishSetup() {
    await checkStatus()
  }

  async function confirmDisable() {
    if (disableCode.length !== 6) return
    setMsg(null)
    setBusy(true)
    const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: disableCode,
    })
    if (verifyErr) {
      setBusy(false)
      setMsg({ type: 'error', text: 'Invalid code — please try again.' })
      setDisableCode('')
      codeRef.current?.focus()
      return
    }
    const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId })
    setBusy(false)
    if (unenrollErr) {
      setMsg({ type: 'error', text: unenrollErr.message })
      return
    }
    await fetch('/api/mfa/backup-codes', { method: 'DELETE' })
    setFactorId('')
    setDisableCode('')
    setStep('disabled')
    setMsg(null)
  }

  if (step === 'loading') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Two-Factor Authentication</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-400 dark:text-gray-500">Checking status…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Two-Factor Authentication</h2>
          {(step === 'enabled' || step === 'disabling' || step === 'backup-codes') && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700">
              Enabled
            </span>
          )}
          {(step === 'disabled' || step === 'enrolling-qr' || step === 'enrolling-verify') && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
              Disabled
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Use an authenticator app (e.g. Google Authenticator, Authy) for extra security at login.
        </p>
      </div>

      <div className="p-6 space-y-4">

        {/* ── DISABLED — show Enable button ── */}
        {step === 'disabled' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              2FA is not enabled. Add an extra layer of security to your account.
            </p>
            <button
              onClick={startEnrollment}
              disabled={busy}
              className="shrink-0 text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Starting…' : 'Enable 2FA'}
            </button>
          </div>
        )}

        {/* ── STEP 1 — QR code ── */}
        {step === 'enrolling-qr' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Scan this QR code with your authenticator app, then click <strong>Next</strong>.
            </p>
            <div
              className="flex items-center justify-center p-4 bg-white dark:bg-white rounded-xl border border-gray-200 dark:border-gray-600 w-fit"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <details className="text-sm">
              <summary className="cursor-pointer text-indigo-600 dark:text-indigo-400 hover:underline select-none">
                Can&apos;t scan? Enter the code manually
              </summary>
              <code className="block mt-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-xs font-mono tracking-widest text-gray-700 dark:text-gray-300 break-all">
                {secret}
              </code>
            </details>
            <Msg msg={msg} />
            <div className="flex justify-end">
              <button
                onClick={() => { setStep('enrolling-verify'); setMsg(null) }}
                className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 — Verify code ── */}
        {step === 'enrolling-verify' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Enter the 6-digit code from your authenticator app to confirm setup.
            </p>
            <div>
              <label className={labelCls}>Verification code</label>
              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') verifyEnrollment() }}
                placeholder="000000"
                className={inputCls}
              />
            </div>
            <Msg msg={msg} />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setStep('enrolling-qr'); setMsg(null) }}
                className="text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-4 py-2 rounded-lg hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
              >
                Back
              </button>
              <button
                onClick={verifyEnrollment}
                disabled={busy || verifyCode.length !== 6}
                className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 — Backup codes ── */}
        {step === 'backup-codes' && (
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <strong>Save these backup codes now.</strong> They won&apos;t be shown again. Each code can be used once if you lose access to your authenticator app.
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, i) => (
                <code
                  key={i}
                  className="block px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-xs font-mono tracking-widest text-gray-800 dark:text-gray-200 text-center border border-gray-200 dark:border-gray-600"
                >
                  {code}
                </code>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={finishSetup}
                className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                I&apos;ve saved my codes
              </button>
            </div>
          </div>
        )}

        {/* ── ENABLED — show Disable button ── */}
        {step === 'enabled' && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your account is protected with two-factor authentication.
            </p>
            <button
              onClick={() => { setStep('disabling'); setMsg(null) }}
              className="shrink-0 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 px-5 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Disable 2FA
            </button>
          </div>
        )}

        {/* ── DISABLE CONFIRM ── */}
        {step === 'disabling' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Enter your authenticator code to confirm. This will remove 2FA from your account.
            </p>
            <div>
              <label className={labelCls}>Authenticator code</label>
              <input
                ref={codeRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={disableCode}
                onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') confirmDisable() }}
                placeholder="000000"
                className={inputCls}
              />
            </div>
            <Msg msg={msg} />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setStep('enabled'); setMsg(null) }}
                className="text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 px-4 py-2 rounded-lg hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisable}
                disabled={busy || disableCode.length !== 6}
                className="text-sm bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Disabling…' : 'Confirm Disable'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
