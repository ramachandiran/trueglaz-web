import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, money, useApi } from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import './DetailPage.css'

/**
 * Where /sell/:id goes.
 *
 * Notifications and emails about a submission (approved, ship-by reminder,
 * more time, lapsed, rejected) link here, and so does the "unfinished
 * submissions" list on Selling. It used to render a blank new-submission form,
 * so every one of those links lost the seller's place.
 *
 * A sent submission is worked from its item's page — the label, the ship-by
 * date and "Ship it to us" live there — so this forwards to it. A draft is one
 * that stopped part-way (a photo upload failed, the tab closed); its details are
 * already saved, so it can be sent as it is.
 */
export function SubmissionLinkPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const view = useApi(() => api.submission(id), [id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (view.loading) return <Loading label="Opening your submission" />
  // Gone — a discarded draft, or a link from before it was removed. Retrying
  // cannot bring it back, so say so and point at Selling instead.
  if (view.error instanceof ApiError && view.error.status === 404) {
    return (
      <article className="detail">
        <header className="detail__head">
          <h1 className="detail__title">This submission no longer exists</h1>
          <p className="tg-muted">It may have been discarded. Everything you have with us is on Selling.</p>
        </header>
        <Link className="tg-button tg-button--primary" to="/sell/manage">Go to Selling</Link>
      </article>
    )
  }
  if (view.error) return <ErrorNote error={view.error} onRetry={view.reload} />
  if (!view.data) return null

  const { submission, items } = view.data
  if (submission.state !== 'draft') {
    return <Navigate to={items[0] ? `/items/${items[0].id}` : '/sell/manage'} replace />
  }
  // Nothing was saved before it stopped: there is nothing to finish, start again.
  if (items.length === 0) return <Navigate to="/sell/new" replace />

  async function send() {
    setBusy(true); setError(null)
    try {
      await api.submitSubmission(id)
      nav('/sell/manage?submitted=true')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send it')
    } finally { setBusy(false) }
  }

  return (
    <article className="detail">
      <div className="detail__back-row">
        <Link className="detail__back" to="/sell/manage">← Selling</Link>
      </div>
      <header className="detail__head">
        <h1 className="detail__title">Finish your submission</h1>
        <p className="tg-muted">
          This was saved but never sent, so it is not with us yet. Everything below is kept — send it as it is,
          or open the item to check the details first.
        </p>
      </header>
      <section className="tg-card detail__section">
        <ul className="detail__list">
          {items.map((i) => (
            <li key={i.id}>
              <Link to={`/items/${i.id}`}><strong>{i.modelFreeText || i.internalSku}</strong></Link>
              {' · '}{money(i.askingAmountMinor)} asked
            </li>
          ))}
        </ul>
        {error && <p className="ops__error" role="alert">{error}</p>}
        <div className="detail__actions" style={{ display: 'flex', gap: 'var(--tg-space-2)', marginTop: 'var(--tg-space-3)' }}>
          <button className="tg-button tg-button--primary" disabled={busy} onClick={send}>
            {busy ? 'Sending…' : 'Send for review'}
          </button>
          <Link className="tg-button" to="/sell/manage">Not now</Link>
        </div>
      </section>
    </article>
  )
}
