import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError, useSession } from '@trueglaz/core'
import './SignInPage.css'

/**
 * OTP sign-in.
 *
 * Two steps: ask for a code, then exchange it for a session. The API answers the
 * first step identically whether or not the contact has an account, so this
 * screen must not imply otherwise — "if that address has an account" is
 * deliberate wording, not vagueness.
 */
export function SignInPage() {
  const nav = useNavigate()
  const location = useLocation()
  const { signIn } = useSession()

  const [step, setStep] = useState<'contact' | 'code'>('contact')
  const [contact, setContact] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.requestCode(contact.trim())
      setDevCode(res.devCode)
      setStep('code')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a code')
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.verifyCode(contact.trim(), code.trim())
      await signIn({
        token: res.token,
        expiresAt: res.expiresAt,
        userId: res.user.userId,
        displayName: res.user.displayName,
        email: res.user.email,
        roles: res.user.roles,
      })
      nav(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="signin">
      <div className="signin__card tg-card">
        <h1 className="signin__title">Sign in to TrueGlaz</h1>

        {step === 'contact' ? (
          <form onSubmit={sendCode} className="signin__form">
            <p className="tg-muted signin__blurb">
              We'll send a one-time code to your email or phone.
            </p>
            <label className="signin__label" htmlFor="contact">Email or phone</label>
            <input
              id="contact"
              className="tg-input"
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="you@example.com"
            />
            <button className="tg-button tg-button--primary signin__submit" disabled={busy || !contact.trim()}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="signin__form">
            <p className="tg-muted signin__blurb">
              If <strong>{contact}</strong> has an account, a code is on its way. It expires in a few minutes.
            </p>
            <label className="signin__label" htmlFor="code">Code</label>
            <input
              id="code"
              className="tg-input signin__code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />

            {devCode && (
              // Only ever present when the API runs with EXPOSE_DEV_CODE on.
              <p className="signin__dev">
                Development build — your code is <strong>{devCode}</strong>
              </p>
            )}

            <button className="tg-button tg-button--primary signin__submit" disabled={busy || code.length < 4}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button
              type="button"
              className="tg-button tg-button--subtle"
              onClick={() => { setStep('contact'); setCode(''); setError(null) }}
            >
              Use a different address
            </button>
          </form>
        )}

        {error && <p className="signin__error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
