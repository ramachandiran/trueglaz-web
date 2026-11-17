import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError, dateOnly, useApi, useSession, type CodeSent } from '@trueglaz/core'
import './AccountData.css'

export const ERASED = [
  'Your name, email and phone number',
  'Saved addresses',
  'Vault items, serial numbers and notes',
  'Wishes, saved items and price alerts',
  'Notifications, devices and sign-ins',
  'Identity documents, unless we paid you as a seller',
]
export const KEPT = [
  'Orders and invoices: GST law asks us to keep them for 8 years',
  'Payouts and their bank reference, for income tax',
  'Insurance policies, which belong to the insurer',
]

/**
 * Your data (TG-125): download a copy, or delete the account.
 *
 * The same three calm steps as the app: see what goes and what stays, get a
 * code, type it. Anything still in flight holds the button.
 */
export function AccountData() {
  const status = useApi(() => api.accountDeletion(), [])
  const { signOut } = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const cancelled = params.get('deletion') === 'cancelled'
  const [downloading, setDownloading] = useState(false)
  const [sent, setSent] = useState<CodeSent | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setDownloading(true); setError(null)
    try {
      const { blob, filename } = await api.myDataFile()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not prepare the download')
    } finally { setDownloading(false) }
  }

  async function requestCode() {
    setBusy(true); setError(null)
    try {
      const res = await api.requestDeletionCode()
      setSent(res)
      if (res.devCode) setCode(res.devCode)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send a code')
    } finally { setBusy(false) }
  }

  async function confirm() {
    setBusy(true); setError(null)
    try {
      const res = await api.confirmDeletion(code.trim())
      // Leave the guarded page first, then drop the (already revoked) session.
      navigate(`/delete-account?scheduled=${encodeURIComponent(res.dueAt ?? '')}`, { replace: true })
      await signOut()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete the account')
      setBusy(false)
    }
  }

  const s = status.data
  const blocked = (s?.blockers.length ?? 0) > 0

  return (
    <section className="tg-card profile__section" id="your-data">
      <h2 className="profile__section-title">Your data</h2>
      {cancelled && <p className="profile__ok" role="status">Welcome back. Your account is no longer being deleted; everything is as you left it.</p>}

      <h3 className="profile__subheading">Download my data</h3>
      <p className="tg-muted profile__blurb">
        A copy of everything we hold about your account as one JSON file: profile, addresses, orders, sales, payouts, wishes and settings.
      </p>
      <div className="profile__actions">
        <button className="tg-button" disabled={downloading} onClick={download}>
          {downloading ? 'Preparing…' : 'Download my data'}
        </button>
      </div>

      <h3 className="profile__subheading account-data__danger-title">Delete my account</h3>
      <p className="tg-muted profile__blurb">
        You get {s?.graceDays ?? 30} days to change your mind. We sign you out everywhere straight away; signing in again
        before the date cancels it. After that it cannot be undone.
      </p>
      <div className="account-data__lists">
        <div>
          <p className="account-data__list-title">What we erase</p>
          <ul>{ERASED.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
        <div>
          <p className="account-data__list-title">What the law makes us keep, without your name</p>
          <ul>{KEPT.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      </div>

      {blocked && (
        <div className="account-data__blockers" role="status">
          <strong>Finish these first</strong>
          <ul>{s!.blockers.map((b) => <li key={b.code}>{b.message} ({b.count})</li>)}</ul>
          <span className="tg-muted">Once they are done, come back here.</span>
        </div>
      )}

      {!sent ? (
        <div className="profile__actions">
          <button className="tg-button account-data__danger" disabled={busy || blocked || !s} onClick={requestCode}>
            Send code to delete my account
          </button>
        </div>
      ) : (
        <div className="profile__confirm">
          <p className="tg-muted">We sent a code to <strong>{sent.contact}</strong>.</p>
          <div className="profile__actions">
            <input className="tg-input profile__code" value={code} onChange={(e) => setCode(e.target.value)}
              inputMode="numeric" autoComplete="one-time-code" placeholder="Code" aria-label="Verification code" />
            <button className="tg-button account-data__danger" disabled={busy || code.trim().length < 4} onClick={confirm}>
              Delete my account
            </button>
            <button className="tg-button tg-button--subtle" disabled={busy} onClick={requestCode}>Send a new code</button>
            <button className="tg-button" onClick={() => { setSent(null); setCode('') }}>Cancel</button>
          </div>
        </div>
      )}
      {s?.state === 'scheduled' && s.dueAt && <p className="profile__ok">Scheduled for deletion on {dateOnly(s.dueAt)}.</p>}
      {error && <p className="profile__error" role="alert">{error}</p>}
    </section>
  )
}
