import { useState } from 'react'
import { api, ApiError, type KycStatus, type useApi } from '@trueglaz/core'
import './EkycPanel.css'

/**
 * Aadhaar eKYC, in two steps.
 *
 * Number, then the code UIDAI sends to the mobile registered against it. When
 * it clears there is no review queue: the issuer has answered and the seller has
 * proved they hold the registered phone, which is strictly more than a staff
 * member comparing a typed name to a photograph of a card could establish.
 *
 * The number is sent and not kept — not here, not on the server. What comes back
 * is a masked mobile, so the seller can tell at a glance whether the phone being
 * rung is one they still have.
 */
export function EkycPanel({ kyc, onVerified }: {
  kyc: ReturnType<typeof useApi<KycStatus>>
  onVerified: () => void
}) {
  const [aadhaar, setAadhaar] = useState('')
  const [otp, setOtp] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const digits = aadhaar.replace(/\D/g, '')

  async function send() {
    setBusy(true); setError(null)
    try {
      const r = await api.startEkyc(digits)
      setSentTo(r.mobileHint ?? 'your registered mobile')
      setDevCode(r.devCode)
      setOtp('')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send the code')
    } finally { setBusy(false) }
  }

  async function verify() {
    setBusy(true); setError(null)
    try {
      await api.verifyEkyc(otp.replace(/\D/g, ''))
      kyc.reload(); onVerified()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not verify that code')
      // A refusal may have spent the last attempt and dropped the challenge, so
      // the seller is put back at the start rather than left typing into one
      // that no longer exists.
      if (e instanceof ApiError && e.status === 429) { setSentTo(null); setOtp('') }
    } finally { setBusy(false) }
  }

  return (
    <div className="ekyc">
      {!sentTo ? (
        <>
          <label className="ekyc__field">
            <span className="ekyc__label">Aadhaar number</span>
            <input
              className="tg-input ekyc__number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="1234 5678 9012"
              value={aadhaar}
              /* Grouped as it is printed on the card, which is how people read
                 a twelve-digit number back to check it. */
              onChange={(e) => setAadhaar(
                e.target.value.replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 '),
              )}
            />
          </label>
          <p className="tg-muted ekyc__hint">
            We send this to UIDAI and do not keep it — only the last four digits stay
            with us. A one-time code goes to the mobile registered against it.
          </p>
          <button
            className="tg-button tg-button--primary"
            disabled={busy || digits.length !== 12}
            onClick={send}
          >
            {busy ? 'Sending…' : 'Send one-time code'}
          </button>
        </>
      ) : (
        <>
          <p className="ekyc__sent">
            Code sent to <strong>{sentTo}</strong>.
          </p>
          {devCode && (
            <p className="ekyc__dev">
              Development build — the code is <strong>{devCode}</strong>. A real
              deployment never shows this.
            </p>
          )}
          <label className="ekyc__field">
            <span className="ekyc__label">One-time code</span>
            <input
              className="tg-input ekyc__otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          <div className="ekyc__actions">
            <button
              className="tg-button tg-button--primary"
              disabled={busy || otp.length < 4}
              onClick={verify}
            >
              {busy ? 'Checking…' : 'Verify'}
            </button>
            <button
              className="tg-button"
              disabled={busy}
              onClick={() => { setSentTo(null); setOtp(''); setError(null) }}
            >
              Use a different number
            </button>
          </div>
          <p className="tg-muted ekyc__hint">
            Not arriving? The code goes to the mobile linked to that Aadhaar, which
            may not be the number you sign in with.
          </p>
        </>
      )}

      {error && <p className="ekyc__error" role="alert">{error}</p>}
    </div>
  )
}
