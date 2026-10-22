import { useState } from 'react'
import { api, ApiError } from '@trueglaz/core'
import { PhotoPicker } from './PhotoPicker'
import './ShipToUs.css'

/**
 * The seller records the courier handoff for a pre-approved parcel.
 *
 * Third party is the default: the seller shipped it themselves and tells us the
 * courier and consignment number. "Courier by TG" reuses the label issued at
 * pre-approval. Either way a photo of the handed-over parcel is required before
 * the unit is marked on its way.
 */
export function ShipToUs({ submissionId, itemId, onDone }: { submissionId: string; itemId: string; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [arrangedBy, setArrangedBy] = useState<'third_party' | 'trueglaz'>('third_party')
  const [courierName, setCourierName] = useState('')
  const [consignmentId, setConsignmentId] = useState('')
  const [shippedDate, setShippedDate] = useState(today)
  const [weightKg, setWeightKg] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (arrangedBy === 'third_party') {
      if (!courierName.trim()) { setError('Which courier did you use?'); return }
      if (!consignmentId.trim()) { setError('Enter the consignment / tracking id.'); return }
    }
    if (weightKg && !(Number(weightKg) > 0)) { setError('Weight must be a positive number.'); return }
    if (photos.length === 0) { setError('A photo of the handed-over parcel is required.'); return }
    setError(null); setBusy(true)
    try {
      for (const f of photos) await api.uploadPhoto(f, { ownerType: 'item', ownerId: itemId, role: 'seller_submission' })
      await api.shipSubmission(submissionId, {
        arrangedBy,
        courierName: arrangedBy === 'third_party' ? courierName.trim() : null,
        consignmentId: arrangedBy === 'third_party' ? consignmentId.trim() : null,
        shippedDate: shippedDate || null,
        weightGrams: weightKg ? Math.round(Number(weightKg) * 1000) : null,
      })
      onDone()
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not mark as shipped') } finally { setBusy(false) }
  }

  return (
    <section className="tg-card detail__section ship">
      <h2 className="detail__section-title">Ship it to us</h2>
      <p className="tg-muted">You're pre-approved. Hand the parcel to a courier, then record it here so we know it's on the way.</p>

      <div className="ship__toggle" role="tablist">
        {([['third_party', 'Courier by third party'], ['trueglaz', 'Courier by TG']] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            className={`ship__opt${arrangedBy === v ? ' ship__opt--on' : ''}`}
            onClick={() => { setArrangedBy(v); setError(null) }}
          >
            {label}
          </button>
        ))}
      </div>

      {arrangedBy === 'third_party' ? (
        <div className="ship__grid">
          <label className="ship__field">
            <span className="sell__field-label">Courier vendor</span>
            <input className="tg-input" value={courierName} onChange={(e) => setCourierName(e.target.value)} placeholder="e.g. Blue Dart, DTDC" />
          </label>
          <label className="ship__field">
            <span className="sell__field-label">Consignment id</span>
            <input className="tg-input" value={consignmentId} onChange={(e) => setConsignmentId(e.target.value)} placeholder="Tracking number from the courier" />
          </label>
          <label className="ship__field">
            <span className="sell__field-label">Date of shipment</span>
            <input className="tg-input" type="date" max={today} value={shippedDate} onChange={(e) => setShippedDate(e.target.value)} />
          </label>
          <label className="ship__field">
            <span className="sell__field-label">Package weight (kg, optional)</span>
            <input className="tg-input" type="number" min="0" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </label>
        </div>
      ) : (
        <p className="tg-muted">TrueGlaz's courier collects using the label from pre-approval. We'll mark it on its way.</p>
      )}

      <div className="ship__photo">
        <span className="sell__field-label">Package photo <strong>(required)</strong></span>
        <PhotoPicker files={photos} onChange={setPhotos} />
      </div>

      {error && <p className="tg-error" role="alert">{error}</p>}
      <button className="tg-button tg-button--primary" disabled={busy} onClick={submit}>
        {busy ? 'Marking as shipped…' : 'Mark as shipped'}
      </button>
    </section>
  )
}
