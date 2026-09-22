import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  api, ApiError, dateOnly, dateTime, useApi, useSession,
  type Address, type CodeSent, type Profile, type SessionInfo,
} from '@trueglaz/core'
import { KycPanel } from '../components/KycPanel'
import { ErrorNote, Loading } from '../components/ui'
import './ProfilePage.css'

/**
 * Everything a person owns about themselves, in one place.
 *
 * Grouped by what someone would come here to change rather than by which table
 * it lives in, and ordered by how often that is: name first, then where parcels
 * go, then where money goes, then the things you touch once.
 */
export function ProfilePage() {
  const profile = useApi(() => api.profile(), [])
  const kyc = useApi(() => api.myKyc(), [])
  const { hash } = useLocation()

  // The account menu links straight to a section; without this the page just
  // opens at the top and the person has to hunt for what they clicked.
  useEffect(() => {
    if (!hash || !profile.data) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash, profile.data])

  // Only the first load takes over the page. Reloading after a save must not
  // unmount the section that just saved — that throws away its "Saved" note and
  // flashes a spinner over work the person can see succeeded.
  if (profile.loading && !profile.data) return <Loading label="Loading your account" />
  if (profile.error && !profile.data) return <ErrorNote error={profile.error} onRetry={profile.reload} />
  if (!profile.data) return null

  const me = profile.data

  return (
    <div className="profile">
      <header className="profile__head">
        <div>
          <h1 className="profile__title">Your account</h1>
          <p className="tg-muted profile__sub">
            {me.email ?? me.phone ?? 'No contact on file'}
            {me.memberSince && ` · with TrueGlaz since ${dateOnly(me.memberSince)}`}
          </p>
        </div>
        {me.roles.length > 0 && (
          <div className="profile__roles">
            {me.roles.map((r) => <span key={r} className="tg-badge tg-badge--accent">{r}</span>)}
          </div>
        )}
      </header>

      <nav className="profile__jump" aria-label="Sections">
        <a href="#details">Personal details</a>
        <a href="#addresses">Addresses</a>
        <a href="#bank">Bank details</a>
        <a href="#identity">Identity</a>
        <a href="#security">Sign-in &amp; security</a>
      </nav>

      <PersonalDetails me={me} onSaved={profile.reload} />
      <Addresses />
      <BankDetails me={me} onSaved={profile.reload} />

      <section className="tg-card profile__section" id="identity">
        <h2 className="profile__section-title">Identity check</h2>
        <p className="tg-muted profile__blurb">
          Required before you can consign anything. We keep only the last four digits
          of whatever document you show us.
        </p>
        <KycPanel kyc={kyc} onChanged={profile.reload} />
      </section>

      <Security me={me} onChanged={profile.reload} />
    </div>
  )
}

/* -- personal details ------------------------------------------------------ */

function PersonalDetails({ me, onSaved }: { me: Profile; onSaved: () => void }) {
  const [name, setName] = useState(me.displayName)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { refresh } = useSession()

  async function save() {
    setBusy(true); setError(null); setSaved(false)
    try {
      await api.updateProfile(name)
      // The header shows this name, so it has to change there too.
      await refresh()
      setSaved(true)
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that')
    } finally { setBusy(false) }
  }

  return (
    <section className="tg-card profile__section" id="details">
      <h2 className="profile__section-title">Personal details</h2>

      <div className="profile__grid">
        <label className="profile__field">
          <span className="profile__label">Name</span>
          <input className="tg-input" value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} />
          <span className="tg-muted profile__hint">Shown on your orders and to our team.</span>
        </label>

        <div className="profile__field">
          <span className="profile__label">Email</span>
          <p className="profile__value">{me.email ?? <span className="tg-muted">Not set</span>}</p>
          <span className="tg-muted profile__hint">
            This signs you in. <a href="#security">Change it below</a>.
          </span>
        </div>

        <div className="profile__field">
          <span className="profile__label">Phone</span>
          <p className="profile__value">{me.phone ?? <span className="tg-muted">Not set</span>}</p>
          <span className="tg-muted profile__hint">
            Used for delivery updates. <a href="#security">Change it below</a>.
          </span>
        </div>
      </div>

      <div className="profile__actions">
        <button
          className="tg-button tg-button--primary"
          disabled={busy || name.trim() === me.displayName || name.trim().length < 2}
          onClick={save}
        >
          {busy ? 'Saving…' : 'Save name'}
        </button>
        {saved && <span className="profile__ok">Saved</span>}
        {error && <span className="profile__error" role="alert">{error}</span>}
      </div>
    </section>
  )
}

/* -- addresses ------------------------------------------------------------- */

const EMPTY_ADDRESS = {
  label: '', recipientName: '', line1: '', line2: '', city: '', state: '', pincode: '', phone: '',
}

function Addresses() {
  const list = useApi(() => api.myAddresses(), [])
  const [form, setForm] = useState(EMPTY_ADDRESS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function act(fn: () => Promise<Address[]>) {
    setBusy(true); setError(null)
    try {
      await fn()
      list.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(false) }
  }

  const rows = list.data ?? []
  const current = rows.find((a) => a.isDefault) ?? rows[0] ?? null

  return (
    <section className="tg-card profile__section" id="addresses">
      <h2 className="profile__section-title">Delivery address</h2>
      <p className="tg-muted profile__blurb">
        Checkout uses the one address you keep here. An order copies it onto
        itself, so changing this later never rewrites an order already placed.
      </p>

      {list.loading && <Loading label="Loading addresses" />}
      {error && <p className="profile__error" role="alert">{error}</p>}

      {current && (
        <ul className="profile__addresses">
          <li className="profile__address profile__address--default">
            <div>
              <strong>{current.label || current.recipientName}</strong>
              <span className="tg-badge tg-badge--good profile__default">Saved address</span>
              <p className="tg-muted profile__address-body">
                {current.recipientName} · {current.line1}{current.line2 ? `, ${current.line2}` : ''}, {current.city}
                {current.state ? `, ${current.state}` : ''} {current.pincode}
                {current.phoneE164 ? ` · ${current.phoneE164}` : ''}
              </p>
            </div>
            <div className="profile__address-actions">
              <button className="tg-button tg-button--subtle" disabled={busy} onClick={() => act(() => api.removeAddress(current.id))}>
                Remove
              </button>
            </div>
          </li>
        </ul>
      )}

      {!current && (
        <div className="profile__address-form">
          <div className="profile__grid">
            <Field label="Label" hint="Home, office — whatever you'll recognise" value={form.label} onChange={(v) => setForm({ ...form, label: v })} />
            <Field label="Recipient" value={form.recipientName} onChange={(v) => setForm({ ...form, recipientName: v })} />
            <Field label="Address line 1" wide value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} />
            <Field label="Address line 2" wide value={form.line2} onChange={(v) => setForm({ ...form, line2: v })} />
            <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
            <Field label="PIN code" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} />
            <Field label="Phone" hint="For the courier" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <div className="profile__actions">
            <button
              className="tg-button tg-button--primary"
              disabled={busy || !form.recipientName.trim() || !form.line1.trim() || !form.city.trim() || !form.pincode.trim()}
              onClick={async () => {
                await act(() => api.addAddress({ ...form, isDefault: true }))
                setForm(EMPTY_ADDRESS)
              }}
            >
              {busy ? 'Saving…' : 'Save address'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/* -- bank details ---------------------------------------------------------- */

function BankDetails({ me, onSaved }: { me: Profile; onSaved: () => void }) {
  // Prefilled from what is already on file: a change is usually one field, and
  // retyping your own name to correct an IFSC is busywork. The account number
  // is never prefilled — we only keep its last four digits, by design.
  const [form, setForm] = useState({
    method: me.payoutAccount?.method ?? 'upi',
    accountHolderName: me.payoutAccount?.accountHolderName ?? '',
    upiVpa: me.payoutAccount?.upiVpa ?? '',
    accountNumber: '',
    ifsc: me.payoutAccount?.ifsc ?? '',
  })
  const [sent, setSent] = useState<CodeSent | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const account = me.payoutAccount

  async function requestCode() {
    setBusy(true); setError(null)
    try {
      const res = await api.requestPayoutCode()
      setSent(res)
      if (res.devCode) setCode(res.devCode)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send a code')
    } finally { setBusy(false) }
  }

  async function save() {
    setBusy(true); setError(null)
    try {
      await api.savePayoutAccount({
        code: code.trim(),
        method: form.method,
        accountHolderName: form.accountHolderName,
        upiVpa: form.method === 'upi' ? form.upiVpa : null,
        accountNumber: form.method === 'bank' ? form.accountNumber : null,
        ifsc: form.method === 'bank' ? form.ifsc : null,
      })
      setSent(null); setCode(''); setDone(true)
      setForm((f) => ({ ...f, accountNumber: '' }))
      onSaved()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save that')
    } finally { setBusy(false) }
  }

  return (
    <section className="tg-card profile__section" id="bank">
      <h2 className="profile__section-title">Bank details</h2>
      <p className="tg-muted profile__blurb">
        Where we send your money when something you consigned sells. Changing this
        needs a code sent to your own contact — a stolen session on its own must not
        be able to redirect a payout.
      </p>

      {account ? (
        <div className="profile__account">
          <span className="tg-badge tg-badge--accent">{account.method.toUpperCase()}</span>
          <strong>
            {account.upiVpa ?? (account.accountLast4 ? `Account ending ${account.accountLast4}` : '—')}
          </strong>
          <span className="tg-muted">
            {account.accountHolderName}
            {account.ifsc && ` · ${account.ifsc}`}
            {account.createdAt && ` · added ${dateOnly(account.createdAt)}`}
          </span>
          <span className={`tg-badge ${account.verificationState === 'verified' ? 'tg-badge--good' : 'tg-badge--warn'}`}>
            {account.verificationState}
          </span>
        </div>
      ) : (
        <p className="tg-muted">
          Nothing on file. Payouts are held until an account is here and verified.
        </p>
      )}

      {done && <p className="profile__ok">Saved. Payouts from now on go to the new account.</p>}

      <h3 className="profile__subheading">{account ? 'Change where it goes' : 'Add an account'}</h3>

      <div className="profile__grid">
        <label className="profile__field">
          <span className="profile__label">Method</span>
          <select className="tg-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            <option value="upi">UPI</option>
            <option value="bank">Bank transfer</option>
          </select>
        </label>

        <Field
          label="Account holder's name"
          hint="Must match the name on the account"
          value={form.accountHolderName}
          onChange={(v) => setForm({ ...form, accountHolderName: v })}
        />

        {form.method === 'upi' ? (
          <Field label="UPI id" value={form.upiVpa} onChange={(v) => setForm({ ...form, upiVpa: v })} />
        ) : (
          <>
            <Field label="Account number" value={form.accountNumber} onChange={(v) => setForm({ ...form, accountNumber: v })} />
            <Field label="IFSC" value={form.ifsc} onChange={(v) => setForm({ ...form, ifsc: v })} />
          </>
        )}
      </div>

      {!sent ? (
        <div className="profile__actions">
          <button
            className="tg-button tg-button--primary"
            disabled={busy || !form.accountHolderName.trim() || (form.method === 'upi' ? !form.upiVpa.trim() : !form.accountNumber.trim() || !form.ifsc.trim())}
            onClick={requestCode}
          >
            {busy ? 'Sending…' : account ? 'Send a code to change this' : 'Send a code to save this'}
          </button>
        </div>
      ) : (
        <div className="profile__confirm">
          <p className="tg-muted">
            We sent a code to <strong>{sent.contact}</strong>. It expires at {dateTime(sent.expiresAt)}.
          </p>
          <div className="profile__actions">
            <input
              className="tg-input profile__code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="6-digit code"
              aria-label="Confirmation code"
            />
            <button className="tg-button tg-button--primary" disabled={busy || code.trim().length < 4} onClick={save}>
              {busy ? 'Saving…' : 'Confirm and save'}
            </button>
            <button className="tg-button" onClick={() => { setSent(null); setCode('') }}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="profile__error" role="alert">{error}</p>}
    </section>
  )
}

/* -- sign-in and security -------------------------------------------------- */

function Security({ me, onChanged }: { me: Profile; onChanged: () => void }) {
  const sessions = useApi(() => api.mySessions(), [])
  const [contact, setContact] = useState('')
  const [sent, setSent] = useState<CodeSent | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function requestCode() {
    setBusy(true); setError(null); setDone(null)
    try {
      const res = await api.requestContactCode(contact.trim())
      setSent(res)
      if (res.devCode) setCode(res.devCode)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send a code')
    } finally { setBusy(false) }
  }

  async function confirm() {
    setBusy(true); setError(null)
    try {
      await api.confirmContact(sent!.contact, code.trim())
      setDone(`${sent!.contact} now signs you in.`)
      setSent(null); setCode(''); setContact('')
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That code did not work')
    } finally { setBusy(false) }
  }

  async function signOutOthers() {
    setBusy(true); setError(null)
    try {
      const { revoked } = await api.signOutOtherSessions()
      setDone(revoked === 0 ? 'Nothing else was signed in.' : `Signed out of ${revoked} other ${revoked === 1 ? 'place' : 'places'}.`)
      sessions.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(false) }
  }

  const rows = sessions.data ?? []

  return (
    <section className="tg-card profile__section" id="security">
      <h2 className="profile__section-title">Sign-in &amp; security</h2>

      <p className="tg-muted profile__blurb">
        There is no password to change: signing in sends a one-time code to your email
        or phone, so the contact below <em>is</em> your credential and nothing we store
        can be stolen and reused. What that makes worth checking instead is the list of
        live sessions — end anything you do not recognise.
      </p>

      <h3 className="profile__subheading">The contact that signs you in</h3>
      <div className="profile__contacts">
        <div>
          <span className="profile__label">Email</span>
          <p className="profile__value">{me.email ?? <span className="tg-muted">Not set</span>}</p>
        </div>
        <div>
          <span className="profile__label">Phone</span>
          <p className="profile__value">{me.phone ?? <span className="tg-muted">Not set</span>}</p>
        </div>
      </div>

      {!sent ? (
        <div className="profile__actions">
          <input
            className="tg-input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="New email, or phone as +919876543210"
            aria-label="New sign-in contact"
          />
          <button className="tg-button" disabled={busy || contact.trim().length < 5} onClick={requestCode}>
            {busy ? 'Sending…' : 'Send a code there'}
          </button>
        </div>
      ) : (
        <div className="profile__confirm">
          <p className="tg-muted">
            We sent a code to <strong>{sent.contact}</strong> — entering it proves you can
            read mail there, which is the whole point of changing it.
          </p>
          <div className="profile__actions">
            <input
              className="tg-input profile__code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="6-digit code"
              aria-label="Confirmation code"
            />
            <button className="tg-button tg-button--primary" disabled={busy || code.trim().length < 4} onClick={confirm}>
              {busy ? 'Confirming…' : 'Confirm'}
            </button>
            <button className="tg-button" onClick={() => { setSent(null); setCode('') }}>Cancel</button>
          </div>
        </div>
      )}

      {done && <p className="profile__ok">{done}</p>}
      {error && <p className="profile__error" role="alert">{error}</p>}

      <h3 className="profile__subheading">Where you're signed in</h3>
      {sessions.loading && <Loading label="Loading sessions" />}
      {rows.length > 0 && (
        <ul className="profile__sessions">
          {rows.map((s) => <SessionRow key={s.id} session={s} />)}
        </ul>
      )}

      <div className="profile__actions">
        <button className="tg-button" disabled={busy || rows.length < 2} onClick={signOutOthers}>
          Sign out everywhere else
        </button>
        <span className="tg-muted profile__hint">
          {rows.length < 2 ? 'This is the only live session.' : 'Keeps this one, so you can carry on here.'}
        </span>
      </div>

      <p className="tg-muted profile__blurb">
        Lost your account entirely, or think someone else has it? <Link to="/sign-in">Sign in again</Link> from
        the device you trust and end the rest from here.
      </p>
    </section>
  )
}

function SessionRow({ session }: { session: SessionInfo }) {
  return (
    <li className={`profile__session${session.current ? ' profile__session--current' : ''}`}>
      <div>
        <strong>{describe(session.userAgent)}</strong>
        {session.current && <span className="tg-badge tg-badge--good profile__default">This device</span>}
        <p className="tg-muted profile__address-body">
          {session.ipAddress ?? 'unknown address'}
          {session.lastSeenAt && ` · last used ${dateTime(session.lastSeenAt)}`}
          {session.signedInAt && ` · signed in ${dateOnly(session.signedInAt)}`}
        </p>
      </div>
    </li>
  )
}

/**
 * A user-agent string is not something to show a person. This is a guess, and
 * deliberately a rough one — the IP and last-used time below it are what
 * someone actually recognises themselves by.
 */
function describe(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'
  const ua = userAgent.toLowerCase()
  const os = ua.includes('iphone') ? 'iPhone'
    : ua.includes('ipad') ? 'iPad'
      : ua.includes('android') ? 'Android'
        : ua.includes('mac os') ? 'Mac'
          : ua.includes('windows') ? 'Windows'
            : ua.includes('linux') ? 'Linux'
              : 'Unknown device'
  const browser = ua.includes('edg/') ? 'Edge'
    : ua.includes('chrome') ? 'Chrome'
      : ua.includes('safari') ? 'Safari'
        : ua.includes('firefox') ? 'Firefox'
          : null
  return browser ? `${browser} on ${os}` : os
}

function Field({
  label, value, onChange, hint, wide,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  wide?: boolean
}) {
  return (
    <label className={`profile__field${wide ? ' profile__field--wide' : ''}`}>
      <span className="profile__label">{label}</span>
      <input className="tg-input" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="tg-muted profile__hint">{hint}</span>}
    </label>
  )
}
