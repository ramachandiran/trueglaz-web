import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, dateTime, money, useApi } from '@trueglaz/core'
import { Empty, ErrorNote, Loading } from '../components/ui'
import './OpsPage.css'

/**
 * Getting sold items to buyers.
 *
 * Dispatch and the delivery scan are separate because the acceptance window
 * starts at delivery, not at dispatch — and that window is what eventually
 * releases the seller's money.
 */
export function FulfilmentPage() {
  const open = useApi(() => api.orderLines('open'), [])
  const dispatched = useApi(() => api.orderLines('dispatched'), [])
  const delivered = useApi(() => api.orderLines('delivered'), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setError(null)
    try {
      await fn()
      open.reload(); dispatched.reload(); delivered.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(null) }
  }

  if (open.loading && dispatched.loading) return <Loading label="Loading fulfilment" />
  if (open.error) return <ErrorNote error={open.error} onRetry={open.reload} />

  const nothing = !(open.data?.length || dispatched.data?.length || delivered.data?.length)

  return (
    <div className="ops">
      <h1 className="ops__title">Fulfilment</h1>
      {error && <p className="ops__error" role="alert">{error}</p>}
      {nothing && <Empty title="Nothing to fulfil" hint="Paid orders appear here for packing and dispatch." />}

      <Section
        title="Paid — ready to dispatch"
        lines={open.data ?? []}
        action={(l) => (
          <button className="tg-button tg-button--primary" disabled={busy === l.id} onClick={() => act(l.id, () => api.dispatchLine(l.id))}>
            {busy === l.id ? 'Dispatching…' : 'Dispatch'}
          </button>
        )}
      />

      <Section
        title="In transit"
        lines={dispatched.data ?? []}
        action={(l) => (
          <button className="tg-button tg-button--primary" disabled={busy === l.id} onClick={() => act(l.id, () => api.deliverLine(l.id))}>
            {busy === l.id ? 'Recording…' : 'Mark delivered'}
          </button>
        )}
      />

      <Section
        title="Delivered — waiting on the buyer"
        lines={delivered.data ?? []}
        action={(l) => (
          <div className="ops__inbound-note">
            <span className="tg-muted">
              {l.acceptanceWindowEndsAt ? `Window closes ${dateTime(l.acceptanceWindowEndsAt)}` : 'Acceptance window open'}
            </span>
            <button
              className="tg-button"
              disabled={busy === l.id}
              onClick={() => act(l.id, () => api.acceptLine(l.id, true))}
              title="Close the window on the buyer's behalf once it has expired"
            >
              Auto-accept
            </button>
          </div>
        )}
      />
    </div>
  )
}

function Section({
  title, lines, action,
}: { title: string; lines: any[]; action: (l: any) => React.ReactNode }) {
  if (lines.length === 0) return null
  return (
    <section className="tg-card ops__card">
      <h2 className="ops__subtitle">{title} ({lines.length})</h2>
      {lines.map((l) => (
        <div key={l.id} className="ops__inbound">
          <div>
            <Link to={`/items/${l.consignmentItemId}`} className="tg-mono">{l.consignmentItemId.slice(0, 8)}</Link>
            <span className="tg-badge tg-badge--accent">{l.gradeCodeAtSale}</span>
            <span className="tg-muted"> {money(l.itemPriceMinor)}</span>
          </div>
          {action(l)}
        </div>
      ))}
    </section>
  )
}
