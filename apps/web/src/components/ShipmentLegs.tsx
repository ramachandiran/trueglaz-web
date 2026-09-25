import { api, dateTime, money, useApi } from '@trueglaz/core'
import { ErrorNote, Loading } from './ui'
import './ShipmentLegs.css'

/**
 * Where a unit has physically been.
 *
 * A consigned camera travels at least twice and sometimes four times, and until
 * now only the first leg was written down. Shown as a journey rather than a
 * table because that is the shape of the question: what happened, in order, and
 * where is it now.
 */
export function ShipmentLegs({ itemId }: { itemId: string }) {
  const legs = useApi(() => api.itemShipments(itemId), [itemId])

  if (legs.loading) return <Loading label="Loading shipments" />
  if (legs.error) return <ErrorNote error={legs.error} onRetry={legs.reload} />

  const rows = legs.data ?? []
  if (rows.length === 0) {
    return <p className="tg-muted legs__none">Nothing has shipped yet.</p>
  }

  return (
    <ol className="legs">
      {rows.map((leg) => {
        const done = leg.state === 'delivered'
        return (
          <li key={leg.id} className={`legs__leg${done ? ' legs__leg--done' : ''}`}>
            <span className="legs__dot" aria-hidden="true" />
            <div className="legs__body">
              <div className="legs__head">
                <strong>{leg.label}</strong>
                <span className={`tg-badge ${done ? 'tg-badge--good' : 'tg-badge--warn'}`}>{leg.state}</span>
              </div>
              <div className="tg-muted legs__meta">
                <span>{leg.courierCode}</span>
                {leg.trackingNumber
                  ? <span className="tg-mono">{leg.trackingNumber}</span>
                  : <span>no tracking number yet</span>}
                {leg.insuredValueMinor != null && <span>insured {money(leg.insuredValueMinor)}</span>}
              </div>
              <div className="tg-muted legs__meta">
                {leg.dispatchedAt && <span>sent {dateTime(leg.dispatchedAt)}</span>}
                {leg.deliveredAt && <span>arrived {dateTime(leg.deliveredAt)}</span>}
              </div>
              {leg.notes && <p className="legs__notes">{leg.notes}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
