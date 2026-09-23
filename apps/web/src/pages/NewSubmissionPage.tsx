import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, money, useApi } from '@trueglaz/core'
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
  const existing = useApi(() => (id ? api.submission(id) : Promise.resolve(null)), [id])

  const [submissionId, setSubmissionId] = useState<string | null>(id ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [item, setItem] = useState({
    productModelId: '',
    modelFreeText: '',
    serialNumber: '',
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
        productModelId: item.productModelId || null,
        modelFreeText: item.productModelId ? null : item.modelFreeText || null,
        serialNumber: item.serialNumber || null,
        declaredGradeCode: item.declaredGradeCode,
        askingAmountMinor: Math.round(Number(item.asking) * 100),
        floorAmountMinor: item.floor ? Math.round(Number(item.floor) * 100) : null,
      })
      setItem({ ...item, productModelId: '', modelFreeText: '', serialNumber: '', asking: '', floor: '' })
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

  const askingNum = Number(item.asking)
  const floorNum = Number(item.floor)
  const floorTooHigh = !!item.floor && !!item.asking && floorNum > askingNum
  const canAdd = askingNum > 0 && (item.productModelId || item.modelFreeText) && !floorTooHigh

  return (
    <div className="sell">
      <h1 className="sell__title">Consign an item</h1>

      <section className="tg-card sell__panel">
        <h2 className="sell__panel-title">What are you sending?</h2>
        <div className="sell__form-grid">
          <label className="sell__field sell__field--wide">
            <span className="sell__field-label">Model</span>
            <select
              className="tg-select"
              value={item.productModelId}
              onChange={(e) => setItem({ ...item, productModelId: e.target.value })}
            >
              <option value="">Not in the list — I'll describe it</option>
              {(models.data?.content ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>

          {!item.productModelId && (
            <label className="sell__field sell__field--wide">
              <span className="sell__field-label">Describe it</span>
              <input
                className="tg-input"
                value={item.modelFreeText}
                placeholder="e.g. Canon FD 50mm f/1.8"
                onChange={(e) => setItem({ ...item, modelFreeText: e.target.value })}
              />
            </label>
          )}

          <label className="sell__field">
            <span className="sell__field-label">Serial number</span>
            <input className="tg-input" value={item.serialNumber} onChange={(e) => setItem({ ...item, serialNumber: e.target.value })} />
          </label>

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
          </label>

          <label className="sell__field">
            <span className="sell__field-label">Asking price (₹)</span>
            <input className="tg-input" type="number" min={1} value={item.asking} onChange={(e) => setItem({ ...item, asking: e.target.value })} />
          </label>

          <label className="sell__field">
            <span className="sell__field-label">Floor (₹)</span>
            <input className="tg-input" type="number" min={0} value={item.floor} onChange={(e) => setItem({ ...item, floor: e.target.value })} />
          </label>
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


