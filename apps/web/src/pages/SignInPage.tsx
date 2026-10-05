import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError, useSession, type AuthResult } from '@trueglaz/core'
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

  const [step, setStep] = useState<'contact' | 'code' | 'name'>('contact')
  const [contact, setContact] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
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

  /**
   * Turns either ending of an auth call into a session, or says it was a signup.
   *
   * Returns true when the caller should stop and ask for a name.
   */
  async function land(res: AuthResult): Promise<boolean> {
    if (res.newUser || !res.token || !res.user) {
      setStep('name')
      return true
    }
    await signIn({
      token: res.token,
      expiresAt: res.expiresAt!,
      userId: res.user.userId,
      displayName: res.user.displayName,
      email: res.user.email,
      roles: res.user.roles,
      sellerActivatedAt: res.user.sellerActivatedAt,
    })
    nav(from, { replace: true })
    return false
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await land(await api.verifyCode(contact.trim(), code.trim()))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  /**
   * The second half of a signup. It sends the same code again, because the
   * server deliberately did not spend it on the verify — that code is still the
   * only proof this person can read that inbox.
   */
  async function createAccount(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await land(await api.signUp(contact.trim(), code.trim(), name.trim()))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account')
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
          <h2 className="signin__title">
            {step === 'name' ? 'Create your account' : 'Sign in'}
          </h2>

          {step === 'contact' ? (
            <form onSubmit={sendCode} className="signin__form">
              <p className="tg-muted signin__blurb">
                We'll send a one-time code to your email or phone. The same code
                signs you in or creates your account — there is nothing else to
                remember.
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
          ) : step === 'code' ? (
            <form onSubmit={verify} className="signin__form">
              <p className="tg-muted signin__blurb">
                A code is on its way to <strong>{contact}</strong>. It expires in a few
                minutes. New here? The same code signs you up.
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
                {busy ? 'Checking…' : 'Continue'}
              </button>
              <button
                type="button"
                className="tg-button tg-button--subtle"
                onClick={() => { setStep('contact'); setCode(''); setError(null) }}
              >
                Use a different address
              </button>
            </form>
          ) : (
            <form onSubmit={createAccount} className="signin__form">
              <p className="tg-muted signin__blurb">
                <strong>{contact}</strong> is confirmed, and there is no account on it
                yet. Tell us what to call you and we will set one up.
              </p>
              <label className="signin__label" htmlFor="name">Your name</label>
              <input
                id="name"
                className="tg-input"
                type="text"
                autoComplete="name"
                autoFocus
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Priya Nair"
              />
              <p className="tg-muted signin__hint">
                This is the name on your orders and, if you ever sell with us, on your
                payouts. You can change it later.
              </p>

              <button
                className="tg-button tg-button--primary signin__submit"
                disabled={busy || name.trim().length < 2}
              >
                {busy ? 'Creating…' : 'Create account'}
              </button>
              <button
                type="button"
                className="tg-button tg-button--subtle"
                onClick={() => { setStep('contact'); setCode(''); setName(''); setError(null) }}
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
