import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@trueglaz/core'
import { useApi } from '@trueglaz/core'
import { Timeline } from '../components/Timeline'
import { ErrorNote, GradeBadge, Loading, SeverityBadge } from '../components/ui'
import { buildTimeline } from '@trueglaz/core'
import { dateTime, money } from '@trueglaz/core'
import './DetailPage.css'

export function ListingDetailPage() {
  const { id = '' } = useParams()
  const listing = useApi((a) => api.listing(a, id), [id])

  const itemId = listing.data?.listing.consignmentItemId
  // The listing payload has no lifecycle, so the timeline comes from the item
  // behind it — one physical unit, one history, however many times it is listed.
  const item = useApi((a) => (itemId ? api.item(a, itemId) : Promise.resolve(null)), [itemId])

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
