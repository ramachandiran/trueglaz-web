import { useState } from 'react'
import { api, ApiError, type KycStatus, type useApi } from '@trueglaz/core'
import './EkycPanel.css'

/** Shown when the server does not send its own wording (an older API). */
const DEFAULT_CONSENT =
  'I agree to share my Aadhaar details (name, date of birth, gender and the last four digits) from DigiLocker with TrueGlaz to verify my identity for selling. TrueGlaz does not see or store my full Aadhaar number.'

/**
 * Aadhaar through the seller's own DigiLocker.
 *
 * They tick consent, go to DigiLocker (a government site), sign in with the OTP
 * on their Aadhaar-linked mobile and approve sharing. DigiLocker sends them
 * back to /kyc/digilocker/return, which finishes the check. Nobody types an
 * Aadhaar number into TrueGlaz on this route.
 */
export function DigilockerPanel({ kyc, onVerified }: {
  kyc: ReturnType<typeof useApi<KycStatus>>
  onVerified: () => void
}) {
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = !!kyc.data?.digilockerPending

  async function start() {
    setBusy(true); setError(null)
    try {
      const { url } = await api.startDigilocker(true)
      window.location.assign(url)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open DigiLocker')
      setBusy(false)
    }
  }

  // For someone who finished in DigiLocker but closed the tab before it sent
  // them back: the answer is waiting at Cashfree, so ask for it.
  async function check() {
    setBusy(true); setError(null)
    try {
      const r = await api.completeDigilocker()
      if (r.state === 'verified') { kyc.reload(); onVerified() }
      else setError("DigiLocker hasn't confirmed yet. Finish sharing there, then check again.")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not check DigiLocker')
      kyc.reload()
    } finally { setBusy(false) }
  }

  return (
    <div className="ekyc">
      <ol className="ekyc__steps">
        <li>Go to DigiLocker, the government's document wallet.</li>
        <li>Sign in with the code sent to your Aadhaar-linked mobile.</li>
        <li>Allow sharing. You come straight back here, verified.</li>
      </ol>

      <label className="ekyc__consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{kyc.data?.consentText ?? DEFAULT_CONSENT}</span>
      </label>

      <div className="ekyc__actions">
        <button className="tg-button tg-button--primary" disabled={busy || !consent} onClick={start}>
          {busy ? 'Opening DigiLocker…' : pending ? 'Open DigiLocker again' : 'Verify with DigiLocker'}
        </button>
        {pending && (
          <button className="tg-button" disabled={busy} onClick={check}>
            I've finished in DigiLocker
          </button>
        )}
      </div>

      <p className="tg-muted ekyc__hint">
        You must be 18 or over. No DigiLocker account? It takes two minutes at
        digilocker.gov.in — or use another document instead.
      </p>

      {error && <p className="ekyc__error" role="alert">{error}</p>}
    </div>
  )
}
