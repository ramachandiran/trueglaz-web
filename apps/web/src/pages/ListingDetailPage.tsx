import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, isOps, useSession } from '@trueglaz/core'
import { useApi } from '@trueglaz/core'
import { Timeline } from '../components/Timeline'
import { ErrorNote, GradeBadge, Loading, SeverityBadge } from '../components/ui'
import { buildTimeline } from '@trueglaz/core'
import { dateTime, money } from '@trueglaz/core'
import './DetailPage.css'

export function ListingDetailPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { session } = useSession()
  const listing = useApi(() => api.listing(id), [id])

  const itemId = listing.data?.listing.consignmentItemId
  // The lifecycle lives on the item, and the item record is the seller's — it
  // carries their asking price, floor and bin location. Staff see the provenance
  // here; a shopper gets the grade and the disclosed defects, which is what the
  // listing is actually promising them.
  const canSeeProvenance = isOps(session)
  const item = useApi(
    () => (itemId && canSeeProvenance ? api.item(itemId) : Promise.resolve(null)),
    [itemId, canSeeProvenance],
  )

  const steps = useMemo(
    () =>
      item.data
        ? buildTimeline(item.data.history, item.data.item.currentState, item.data.nextLegalStates)
        : [],
    [item.data],
  )

  if (listing.loading) return <Loading label="Loading listing" />
  if (listing.error) return <ErrorNote error={listing.error} onRetry={listing.reload} />
  if (!listing.data) return null

  const d = listing.data

  return (
    <article className="detail">
      <header className="detail__head">
        <div>
          <p className="detail__eyebrow tg-mono tg-muted">{d.internalSku}</p>
          <h1 className="detail__title">{d.listing.title.split('·')[0].trim()}</h1>
          <div className="detail__badges">
            <GradeBadge code={d.listing.gradeCode} />
            {d.gradeLabel && <span className="tg-badge">{d.gradeLabel}</span>}
            {d.gradePosition && <span className="tg-badge">{d.gradePosition}</span>}
          </div>
        </div>
        <div className="detail__figures">
          <div className="detail__figure">
            <span className="detail__figure-label tg-muted">Price</span>
            <span className="detail__figure-value">
              {money(d.listing.priceMinor, d.listing.currency)}
            </span>
          </div>
          {d.listing.state === 'published' && (
            <button
              className="tg-button tg-button--primary detail__buy"
              onClick={() =>
                session
                  ? nav(`/checkout/${d.listing.id}`)
                  : nav('/sign-in', { state: { from: `/checkout/${d.listing.id}` } })
              }
            >
              Buy this one
            </button>
          )}
        </div>
      </header>

      <section className="tg-card detail__section">
        <h2 className="detail__section-title">What TrueGlaz found</h2>
        <p className="detail__blurb">{d.listing.descriptionGenerated}</p>
        {d.gradeDefinition && (
          <p className="tg-muted detail__blurb">
            <strong>{d.listing.gradeCode}</strong> — {d.gradeDefinition}
          </p>
        )}

        <h3 className="detail__section-title">Disclosed defects</h3>
        {d.defects.length === 0 ? (
          <p className="tg-muted">The inspection found no disclosable defects.</p>
        ) : (
          <ul className="detail__list">
            {d.defects.map((x) => (
              <li key={x.id} className="detail__defect">
                <div className="detail__defect-head">
                  <strong>{x.title}</strong>
                  <SeverityBadge severity={x.severity} />
                </div>
                <p className="tg-muted detail__defect-body">{x.descriptionPublic}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {steps.length > 0 && (
        <section className="tg-card detail__section">
          <div className="detail__section-head">
            <h2 className="detail__section-title">Where this unit has been</h2>
            {itemId && <Link to={`/items/${itemId}`}>Full item record →</Link>}
          </div>
          <Timeline steps={steps} orientation="horizontal" />
        </section>
      )}

      {d.priceHistory.length > 0 && (
        <section className="tg-card detail__section">
          <h2 className="detail__section-title">Price history</h2>
          <table className="detail__table">
            <thead>
              <tr><th>From</th><th>To</th><th>Reason</th><th>When</th></tr>
            </thead>
            <tbody>
              {d.priceHistory.map((p) => (
                <tr key={p.id}>
                  <td>{money(p.oldAmountMinor)}</td>
                  <td>{money(p.newAmountMinor)}</td>
                  <td>{p.reason.replace(/_/g, ' ')}</td>
                  <td className="tg-muted">{dateTime(p.changedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </article>
  )
}
