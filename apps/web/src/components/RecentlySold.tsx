import { Link } from 'react-router-dom'
import { api, money, relative, useApi } from '@trueglaz/core'
import './RecentlySold.css'

/**
 * What has recently gone, and for how much.
 *
 * The one thing a used-gear buyer cannot work out from a listing page is what
 * this stuff actually sells for — a marketplace of one-of-one items has no
 * "others are viewing this" to fall back on, and an asking price on its own
 * tells you nothing about whether it is a fair one. Sold prices answer that,
 * and they answer the quieter question too: is anybody buying here at all.
 *
 * Each row links to the item it was, which still shows its condition report. A
 * buyer comparing this listing to one that sold last week can read both.
 */
export function RecentlySold({ limit = 5, excludeId }: { limit?: number; excludeId?: string }) {
  // One more than needed, so removing the listing being looked at does not
  // leave the panel a row short.
  const sold = useApi(() => api.recentlySold(limit + 1), [limit])

  // Quiet on failure and quiet when empty: this is context beside the thing
  // someone came for, and an error box where a nicety should be is worse than
  // the nicety being absent.
  const rows = (sold.data ?? []).filter((s) => s.id !== excludeId).slice(0, limit)
  if (sold.loading || rows.length === 0) return null

  return (
    <aside className="sold" aria-label="Recently sold">
      <h2 className="sold__title">Recently sold</h2>
      <p className="sold__blurb tg-muted">What gear like this has gone for.</p>

      <ol className="sold__list">
        {rows.map((s) => (
          <li key={s.id} className="sold__row">
            <Link to={`/listings/${s.id}`} className="sold__link">
              <span className="sold__name">{s.title}</span>
            </Link>
            <span className="sold__meta">
              <strong className="sold__price">{money(s.priceMinor)}</strong>
              {s.soldAt && <span className="tg-muted sold__when">{relative(s.soldAt)}</span>}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  )
}
