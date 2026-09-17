import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, dateTime, money, useApi } from '@trueglaz/core'
import { Empty, ErrorNote, Loading } from '../components/ui'
import './OrdersPage.css'

/**
 * The buyer's orders, and the one action that matters: accepting delivery.
 *
 * Acceptance is not a formality — it is the moment escrow clears and the seller
 * is owed money, so the page says so rather than presenting a bare button.
 */
export function OrdersPage() {
  const orders = useApi(() => api.myOrders(), [])

  if (orders.loading) return <Loading label="Loading your orders" />
  if (orders.error) return <ErrorNote error={orders.error} onRetry={orders.reload} />

  const rows = orders.data ?? []
  if (rows.length === 0) {
    return (
      <Empty
        title="No orders yet"
        hint="Anything you buy will show up here, with its delivery and acceptance status."
      />
    )
  }

  return (
    <div className="orders">
      <h1 className="orders__title">My orders</h1>
      {rows.map((o) => (
        <OrderCard key={o.id} orderId={o.id} onChanged={orders.reload} />
      ))}
    </div>
  )
}

function OrderCard({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const detail = useApi(() => api.order(orderId), [orderId])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (detail.loading) return <div className="tg-skeleton orders__skeleton" />
  if (detail.error) return <ErrorNote error={detail.error} onRetry={detail.reload} />
  if (!detail.data) return null

  const { order, lines, payments } = detail.data

  async function accept(lineId: string) {
    setBusy(lineId); setError(null)
    try {
      await api.acceptLine(lineId)
      detail.reload()
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not accept')
    } finally {
      setBusy(null)
    }
  }

  return (
    <article className="orders__card tg-card">
      <header className="orders__head">
        <div>
          <span className="tg-mono orders__number">{order.orderNumber}</span>
          <span className={`tg-badge orders__state orders__state--${order.state}`}>
            {order.state.replace(/_/g, ' ')}
          </span>
        </div>
        <span className="orders__total">{money(order.totalMinor)}</span>
      </header>

      <p className="tg-muted orders__meta">
        Placed {dateTime(order.createdAt)}
        {payments.length > 0 && ` · paid ${dateTime(payments[0].capturedAt)}`}
      </p>

      {error && <p className="orders__error" role="alert">{error}</p>}

      <ul className="orders__lines">
        {lines.map((l) => (
          <li key={l.id} className="orders__line">
            <div className="orders__line-main">
              <Link to={`/items/${l.consignmentItemId}`} className="orders__line-link">
                Item {l.gradeCodeAtSale}
              </Link>
              <span className="tg-badge">{l.state}</span>
              <span className="orders__line-price">{money(l.itemPriceMinor)}</span>
            </div>

            {l.state === 'delivered' && (
              <div className="orders__accept">
                <p className="tg-muted orders__accept-note">
                  Delivered. Accepting releases your payment from escrow to the seller
                  {l.acceptanceWindowEndsAt && ` — the window closes ${dateTime(l.acceptanceWindowEndsAt)}`}.
                </p>
                <button
                  className="tg-button tg-button--primary"
                  disabled={busy === l.id}
                  onClick={() => accept(l.id)}
                >
                  {busy === l.id ? 'Accepting…' : 'Accept delivery'}
                </button>
              </div>
            )}

            {l.state === 'accepted' && (
              <p className="tg-muted orders__accept-note">
                Accepted {dateTime(l.acceptedAt)} — the seller has been paid.
              </p>
            )}
          </li>
        ))}
      </ul>
    </article>
  )
}
