import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError, useSession } from '@trueglaz/core'
import { Logo } from '../components/Logo'
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
        sellerActivatedAt: res.user.sellerActivatedAt,
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
      <div className="signin__content">
        <section className="signin__details" aria-label="Why TrueGlaz">
          <p className="signin__eyebrow">Built for trust</p>
          <h1 className="signin__headline">TrueGlaz makes buying and selling used gear clear, safe, and worth the next round.</h1>
          <p className="signin__lede">
            We bring together grading, disclosure, and accountability so both sides know exactly what they are getting before the deal closes.
          </p>

          <div className="signin__feature-grid">
            <article className="signin__feature">
              <span className="signin__feature-index">01</span>
              <h2>How trust works</h2>
              <p>Every unit is inspected and described with visible condition notes so your confidence is earned before checkout.</p>
            </article>
            <article className="signin__feature">
              <span className="signin__feature-index">02</span>
              <h2>Verified disclosure</h2>
              <p>Defects, wear, and finish details are surfaced early, which keeps the market honest and the process transparent.</p>
            </article>
            <article className="signin__feature">
              <span className="signin__feature-index">03</span>
              <h2>Safer transactions</h2>
              <p>From inspection to final handoff, the flow is designed to reduce surprises and protect both buyers and sellers.</p>
            </article>
          </div>

          <div className="signin__proofs">
            <div>
              <strong>Grade-first</strong>
              <span>Every item is reviewed before it reaches the market.</span>
            </div>
            <div>
              <strong>Clear by default</strong>
              <span>Honest condition notes and no hidden surprises.</span>
            </div>
            <div>
              <strong>Built for repeat trust</strong>
              <span>Fast, accountable handoffs keep buyers returning.</span>
            </div>
          </div>
        </section>

        <div className="signin__card tg-card">
          <Logo className="signin__logo signin__logo--card" />
          <h2 className="signin__title">Sign in</h2>

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
    </div>
  )
}
