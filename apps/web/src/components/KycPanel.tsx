import { useState } from 'react'
import { api, ApiError, dateOnly, useApi, type KycStatus } from '@trueglaz/core'
import { Loading } from './ui'
import './KycPanel.css'

const ID_TYPES = [
  { value: 'pan', label: 'PAN' },
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'passport', label: 'Passport' },
  { value: 'driving_licence', label: 'Driving licence' },
  { value: 'voter_id', label: 'Voter ID' },
]

/**
 * The identity gate a seller meets before they can consign anything.
 *
 * Rendered as the whole Sell page until it passes, rather than as a banner over
 * a form that will be refused: letting someone fill in an item and only then
 * telling them they cannot send it is the worse outcome.
 */
export function KycPanel({ kyc, onChanged }: {
  kyc: ReturnType<typeof useApi<KycStatus>>
  onChanged: () => void
}) {
  const [form, setForm] = useState({ legalName: '', dob: '', idType: 'pan', idNumber: '', gstin: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (kyc.loading) return <Loading label="Checking your identity status" />
  const status = kyc.data?.status ?? 'not_started'

  async function submit() {
    setBusy(true); setError(null)
    try {
      await api.submitKyc({
        legalName: form.legalName.trim(),
        dob: form.dob || null,
        idType: form.idType,
        idNumber: form.idNumber.trim(),
        gstin: form.gstin.trim() || null,
      })
      kyc.reload(); onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit that')
    } finally { setBusy(false) }
  }

  if (status === 'in_review') {
    return (
      <section className="tg-card kyc kyc--waiting">
        <h2 className="kyc__title">We're checking your details</h2>
        <p className="tg-muted">
          Submitted {dateOnly(kyc.data?.submittedAt)}. You'll be able to consign as
          soon as it clears — usually within a working day.
        </p>
      </section>
    )
  }

  if (status === 'verified') {
    return (
      <section className="tg-card kyc kyc--ok">
        <div className="kyc__verified">
          <span className="tg-badge tg-badge--good">Identity verified</span>
          <span className="tg-muted">
            {kyc.data?.legalName}
            {kyc.data?.idType && ` · ${kyc.data.idType.toUpperCase()} ending ${kyc.data.idLast4}`}
            {kyc.data?.expiresAt && ` · valid to ${dateOnly(kyc.data.expiresAt)}`}
          </span>
        </div>
      </section>
    )
  }

  const rejected = status === 'rejected'
  const expired = status === 'expired'

  return (
    <section className="tg-card kyc">
      <h2 className="kyc__title">
        {rejected ? 'That check did not pass' : expired ? 'Your identity check has expired' : 'Verify your identity to sell'}
      </h2>

      {rejected && (
        <p className="kyc__rejected">
          Reason: {kyc.data?.rejectedReasonCode?.replace(/_/g, ' ') ?? 'not given'}. Send it again below.
        </p>
      )}

      <p className="tg-muted kyc__why">
        We take physical custody of your gear and later send you money, so we have
        to know who you are first. We keep only the <strong>last four digits</strong> of
        your document — the rest has no use to us after the check.
      </p>

      <div className="kyc__grid">
        <label className="kyc__field kyc__field--wide">
          <span className="kyc__label">Full legal name, as printed on the document</span>
          <input className="tg-input" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
        </label>

        <label className="kyc__field">
          <span className="kyc__label">Date of birth</span>
          <input className="tg-input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
        </label>

        <label className="kyc__field">
          <span className="kyc__label">Document type</span>
          <select className="tg-select" value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>
            {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <label className="kyc__field">
          <span className="kyc__label">Document number</span>
          <input className="tg-input" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} />
        </label>

        <label className="kyc__field">
          <span className="kyc__label">GSTIN <span className="tg-muted">(optional, if you sell as a business)</span></span>
          <input className="tg-input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
        </label>
      </div>

      <button
        className="tg-button tg-button--primary"
        disabled={busy || !form.legalName.trim() || form.idNumber.trim().length < 4}
        onClick={submit}
      >
        {busy ? 'Submitting…' : rejected || expired ? 'Submit again' : 'Submit for verification'}
      </button>

      {error && <p className="kyc__error" role="alert">{error}</p>}
    </section>
  )
}
