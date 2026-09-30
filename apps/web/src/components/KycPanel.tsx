import { useState } from 'react'
import { api, ApiError, dateOnly, useApi, useSession, type KycStatus } from '@trueglaz/core'
import { EkycPanel } from './EkycPanel'
import { PhotoUpload } from './PhotoUpload'
import { Loading } from './ui'
import './KycPanel.css'

/**
 * Which sides we ask for. Mirrors `MediaRole.requiredFor` on the server — the
 * server is the one that enforces it, this only decides what to put on screen
 * so nobody is refused for a document they were never asked for.
 */
const TWO_SIDED = new Set(['aadhaar', 'driving_licence', 'voter_id'])

const ID_TYPES = [
  { value: 'pan', label: 'PAN' },
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
  // Aadhaar first, because it is the one path that finishes in a minute rather
  // than whenever somebody gets to the queue. The document route stays for
  // anyone whose Aadhaar has no mobile on it, or who would rather not use it.
  const [route, setRoute] = useState<'aadhaar' | 'document'>('aadhaar')
  const [form, setForm] = useState({ legalName: '', dob: '', idType: 'pan', idNumber: '', gstin: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { session } = useSession()
  // Uploaded straight away rather than held: unlike a consignment, the thing
  // they attach to already exists — the API creates the check on first upload.
  const docs = useApi(() => api.myKycDocuments(), [])

  // Only while there is nothing to show. A reload sets `loading` without
  // clearing `data`, and swapping the form out mid-flow would discard whatever
  // the seller had already typed.
  if (kyc.loading && !kyc.data) return <Loading label="Checking your identity status" />
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

  const uid = session?.userId
  const existing = (role: string) =>
    (docs.data ?? []).filter((d) => d.docType === role).map((d) => d.media)
  // The server refuses a submission without these; the button simply agrees
  // rather than letting someone press it and be told off.
  const ready =
    existing('id_front').length > 0 &&
    (!TWO_SIDED.has(form.idType) || existing('id_back').length > 0)

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

      <div className="kyc__routes" role="tablist" aria-label="How to verify">
        <button
          type="button" role="tab" aria-selected={route === 'aadhaar'}
          className={`kyc__route${route === 'aadhaar' ? ' kyc__route--on' : ''}`}
          onClick={() => setRoute('aadhaar')}
        >
          <strong>Aadhaar</strong>
          <span className="tg-muted">One-time code. Verified in a minute.</span>
        </button>
        <button
          type="button" role="tab" aria-selected={route === 'document'}
          className={`kyc__route${route === 'document' ? ' kyc__route--on' : ''}`}
          onClick={() => setRoute('document')}
        >
          <strong>Another document</strong>
          <span className="tg-muted">PAN, passport, licence. Checked by a person.</span>
        </button>
      </div>

      {route === 'aadhaar' ? (
        <EkycPanel kyc={kyc} onVerified={onChanged} />
      ) : (
      <>
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

      <div className="kyc__docs">
        <h3 className="kyc__docs-title">Photograph your document</h3>
        <p className="tg-muted kyc__hint">
          {TWO_SIDED.has(form.idType)
            ? 'Both sides, with all four corners in frame and the text readable.'
            : 'The side with your photograph and number, with all four corners in frame.'}
          {' '}We keep these only as long as the check is valid.
        </p>

        {uid && (
          <div className="kyc__uploads">
            <div className="kyc__upload">
              <span className="kyc__label">Front</span>
              <PhotoUpload
                ownerType="kyc" ownerId={uid} role="id_front" max={3}
                existing={existing('id_front')}
                onUploaded={() => { docs.reload(); kyc.reload() }}
                hint="JPEG or PNG, 15 MB."
              />
            </div>

            {TWO_SIDED.has(form.idType) && (
              <div className="kyc__upload">
                <span className="kyc__label">Back</span>
                <PhotoUpload
                  ownerType="kyc" ownerId={uid} role="id_back" max={3}
                  existing={existing('id_back')}
                  onUploaded={() => { docs.reload(); kyc.reload() }}
                  hint="JPEG or PNG, 15 MB."
                />
              </div>
            )}
          </div>
        )}
      </div>

      <button
        className="tg-button tg-button--primary"
        disabled={busy || !form.legalName.trim() || form.idNumber.trim().length < 4 || !ready}
        onClick={submit}
      >
        {busy ? 'Submitting…' : rejected || expired ? 'Submit again' : 'Submit for verification'}
      </button>

      {error && <p className="kyc__error" role="alert">{error}</p>}
      </>
      )}
    </section>
  )
}
