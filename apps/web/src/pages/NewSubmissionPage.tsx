import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, money, singularCategory, useApi } from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import './SellPage.css'

/**
 * Consign an item.
 *
 * A submission is a draft you can add to, then send. The floor matters more than
 * the asking price — it is the number that decides whether we can list without
 * coming back to you — so the form explains it rather than presenting two
 * interchangeable boxes.
 */
export function NewSubmissionPage() {
  const { id } = useParams()
  const nav = useNavigate()

  const models = useApi(() => api.models(), [])
  const grades = useApi(() => api.grades(), [])
  const categories = useApi(() => api.categories(), [])
  const brands = useApi(() => api.brands(), [])
  const existing = useApi(() => (id ? api.submission(id) : Promise.resolve(null)), [id])

  const [submissionId, setSubmissionId] = useState<string | null>(id ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [item, setItem] = useState({
    categoryId: '',
    brandId: '',
    modelFreeText: '',
    description: '',
    reasonToSell: '',
    serialNumber: '',
    underWarranty: '' as '' | 'yes' | 'no',
    hasBill: false,
    hasBox: false,
    declaredGradeCode: 'TG-8',
    asking: '',
    floor: '',
  })

  const added = existing.data?.items ?? []

  async function ensureSubmission(): Promise<string> {
    if (submissionId) return submissionId
    const s = await api.createSubmission('guided')
    setSubmissionId(s.id)
    return s.id
  }

  async function addItem() {
    setBusy(true); setError(null)
    try {
      const sid = await ensureSubmission()
      await api.addItem(sid, {
        // The model is typed; the API links it to a catalogue row when the
        // brand, type and name line up, so guided pricing still has something
        // to price against.
        modelFreeText: item.modelFreeText || null,
        categoryId: item.categoryId,
        brandId: item.brandId,
        description: item.description || null,
        reasonToSell: item.reasonToSell || null,
        underWarranty: item.underWarranty === '' ? null : item.underWarranty === 'yes',
        hasBill: item.hasBill,
        hasBox: item.hasBox,
        serialNumber: item.serialNumber || null,
        declaredGradeCode: item.declaredGradeCode,
        askingAmountMinor: Math.round(Number(item.asking) * 100),
        floorAmountMinor: item.floor ? Math.round(Number(item.floor) * 100) : null,
      })
      // The type and brand stay: a second item is usually more of the same.
      setItem({
        ...item,
        modelFreeText: '', description: '', reasonToSell: '', serialNumber: '',
        underWarranty: '', hasBill: false, hasBox: false, asking: '', floor: '',
      })
      existing.reload()
      if (!id) nav(`/sell/${sid}`, { replace: true })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add that item')
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    if (!submissionId) return
    setBusy(true); setError(null)
    try {
      await api.submitSubmission(submissionId)
      nav('/sell')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit')
    } finally {
      setBusy(false)
    }
  }

  if (id && existing.loading) return <Loading label="Loading submission" />
  if (id && existing.error) return <ErrorNote error={existing.error} onRetry={existing.reload} />

  // Shown while typing so a seller can see their words landed on a catalogue
  // row — which is the difference between a guided price and waiting for staff.
  const matched = (models.data?.content ?? []).find(
    (m) =>
      m.brandId === item.brandId &&
      m.categoryId === item.categoryId &&
      norm(m.name) === norm(item.modelFreeText),
  )

  const askingNum = Number(item.asking)
  const floorNum = Number(item.floor)
  const floorTooHigh = !!item.floor && !!item.asking && floorNum > askingNum
  const canAdd =
    askingNum > 0 &&
    !!item.categoryId &&
    !!item.brandId &&
    item.modelFreeText.trim().length > 1 &&
    !floorTooHigh

  return (
    <div className="consign">
      <h1 className="sell__title">Consign an item</h1>

      <section className="tg-card sell__panel">
        <h2 className="sell__panel-title">What are you sending?</h2>

        <fieldset className="sell__fieldset">
          <legend className="sell__field-label">Type</legend>
          <div className="sell__choices">
            {(categories.data ?? []).map((c) => (
              <label key={c.id} className={`sell__choice${item.categoryId === c.id ? ' sell__choice--on' : ''}`}>
                <input
                  type="radio"
                  name="category"
                  checked={item.categoryId === c.id}
                  onChange={() => setItem({ ...item, categoryId: c.id })}
                />
                {singularCategory(c.name)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="sell__form-grid">
          <label className="sell__field">
            <span className="sell__field-label">Brand</span>
            <select
              className="tg-select"
              value={item.brandId}
              onChange={(e) => setItem({ ...item, brandId: e.target.value })}
            >
              <option value="">Choose a brand…</option>
              {(brands.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <label className="sell__field">
            <span className="sell__field-label">Model</span>
            <input
              className="tg-input"
              value={item.modelFreeText}
              placeholder="e.g. EOS R6 Mark II"
              onChange={(e) => setItem({ ...item, modelFreeText: e.target.value })}
            />
            {matched && <span className="sell__matched">Matched to {matched.name} in our catalogue</span>}
          </label>

          <label className="sell__field sell__field--wide">
            <span className="sell__field-label">Description</span>
            <textarea
              className="tg-input sell__textarea"
              rows={3}
              value={item.description}
              placeholder="How it has been used and kept, anything a buyer would want to know."
              onChange={(e) => setItem({ ...item, description: e.target.value })}
            />
          </label>

          <label className="sell__field sell__field--wide">
            <span className="sell__field-label">Reason for selling</span>
            <input
              className="tg-input"
              value={item.reasonToSell}
              placeholder="e.g. Moving to a different system"
              onChange={(e) => setItem({ ...item, reasonToSell: e.target.value })}
            />
          </label>

          <label className="sell__field">
            <span className="sell__field-label">Serial number</span>
            <input
              className="tg-input"
              value={item.serialNumber}
              onChange={(e) => setItem({ ...item, serialNumber: e.target.value })}
            />
            <span className="tg-muted sell__hint">
              We check it against the stolen-goods blocklist before listing.
            </span>
          </label>

          <fieldset className="sell__field sell__fieldset">
            <legend className="sell__field-label">Under warranty?</legend>
            <div className="sell__choices">
              {([['yes', 'Yes'], ['no', 'No']] as const).map(([value, label]) => (
                <label key={value} className={`sell__choice${item.underWarranty === value ? ' sell__choice--on' : ''}`}>
                  <input
                    type="radio"
                    name="warranty"
                    checked={item.underWarranty === value}
                    onChange={() => setItem({ ...item, underWarranty: value })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="sell__field sell__field--wide sell__fieldset">
            <legend className="sell__field-label">What comes with it</legend>
            <div className="sell__choices">
              <label className={`sell__choice${item.hasBill ? ' sell__choice--on' : ''}`}>
                <input
                  type="checkbox"
                  checked={item.hasBill}
                  onChange={(e) => setItem({ ...item, hasBill: e.target.checked })}
                />
                Original bill
              </label>
              <label className={`sell__choice${item.hasBox ? ' sell__choice--on' : ''}`}>
                <input
                  type="checkbox"
                  checked={item.hasBox}
                  onChange={(e) => setItem({ ...item, hasBox: e.target.checked })}
                />
                Original box
              </label>
              <label className={`sell__choice${!item.hasBill && !item.hasBox ? ' sell__choice--on' : ''}`}>
                <input
                  type="checkbox"
                  checked={!item.hasBill && !item.hasBox}
                  onChange={() => setItem({ ...item, hasBill: false, hasBox: false })}
                />
                Neither
              </label>
            </div>
          </fieldset>

          <label className="sell__field">
            <span className="sell__field-label">Condition, in your view</span>
            <select
              className="tg-select"
              value={item.declaredGradeCode}
              onChange={(e) => setItem({ ...item, declaredGradeCode: e.target.value })}
            >
              {(grades.data ?? []).filter((g) => g.isActive).sort((a, b) => b.rank - a.rank).map((g) => (
                <option key={g.code} value={g.code}>{g.code} · {g.label}</option>
              ))}
            </select>
            <span className="tg-muted sell__hint">
              Ours is what the listing carries — a technician grades it on arrival.
            </span>
          </label>

          <label className="sell__field">
            <span className="sell__field-label">Asking price (₹)</span>
            <input className="tg-input" type="number" min={1} value={item.asking} onChange={(e) => setItem({ ...item, asking: e.target.value })} />
          </label>

          <label className="sell__field">
            <span className="sell__field-label">Floor (₹)</span>
            <input className="tg-input" type="number" min={0} value={item.floor} onChange={(e) => setItem({ ...item, floor: e.target.value })} />
          </label>

          <div className="sell__field sell__field--wide">
            <span className="sell__field-label">Photos</span>
            <div className="sell__photos">
              <p className="tg-muted sell__hint">
                Not yet — there is nowhere to put them until we settle where uploads are
                stored. When that lands, at least one photo will be required: a picture
                taken before it ships is the only record of what left your hands.
              </p>
            </div>
          </div>
        </div>

        <p className="tg-muted sell__fineprint">
          The floor is the lowest you'd accept. If our valuation lands below it we
          ask you first instead of listing. Leave it blank and we won't have a line to hold.
        </p>
        {floorTooHigh && <p className="sell__error">Your floor is above your asking price.</p>}
        {askingNum > 0 && <FeePreview salePriceMinor={Math.round(askingNum * 100)} />}

        <button className="tg-button tg-button--primary" disabled={busy || !canAdd} onClick={addItem}>
          {busy ? 'Adding…' : 'Add to submission'}
        </button>
        {error && <p className="sell__error" role="alert">{error}</p>}
      </section>

      {added.length > 0 && (
        <section className="tg-card sell__panel">
          <h2 className="sell__panel-title">In this submission ({added.length})</h2>
          <ul className="sell__added">
            {added.map((i) => (
              <li key={i.id}>
                <span className="tg-mono">{i.internalSku}</span>
                <span>{i.modelFreeText ?? 'Catalogue model'}</span>
                <span>{i.declaredGradeCode}</span>
                <span>{money(i.askingAmountMinor)}</span>
              </li>
            ))}
          </ul>
          <button className="tg-button tg-button--primary" disabled={busy} onClick={send}>
            {busy ? 'Sending…' : 'Send for pre-approval'}
          </button>
          <p className="tg-muted sell__fineprint">
            We'll review it and send you a shipping label. Nothing is committed until you post it.
          </p>
        </section>
      )}
    </div>
  )
}

/** What the seller would actually take home, before they commit to a number. */
function FeePreview({ salePriceMinor }: { salePriceMinor: number }) {
  const quote = useApi(() => api.feeQuote(salePriceMinor), [salePriceMinor])
  if (!quote.data) return null
  return (
    <p className="sell__quote">
      At {money(salePriceMinor)} our commission is {money(quote.data.commissionMinor)} and
      you'd receive <strong>{money(quote.data.expectedNetMinor)}</strong>.
    </p>
  )
}

/** Same comparison the API uses when it links a typed model to the catalogue. */
function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}
