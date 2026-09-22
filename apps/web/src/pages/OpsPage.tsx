import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, dateOnly, money, useApi, isStaff, useSession } from '@trueglaz/core'
import { Empty, ErrorNote, Loading, StateBadge } from '../components/ui'
import './OpsPage.css'

type Queue = 'intake' | 'inspect' | 'price'

/**
 * The operations floor, organised by what is waiting rather than by entity.
 *
 * Each queue answers "what should I pick up next", so the counts are the point:
 * an empty queue should look empty, not like a page that failed to load.
 */
export function OpsPage() {
  const { session } = useSession()
  const [queue, setQueue] = useState<Queue>('intake')

  // Intake and pricing are staff work. A technician asking for them gets a 403,
  // so they are not asked for: an error where a queue should be reads as the
  // page being broken, not as a role they do not hold.
  const staff = isStaff(session)
  const pending = useApi(() => (staff ? api.pendingSubmissions() : Promise.resolve([])), [staff])
  const received = useApi(() => api.itemQueue('RECEIVED'), [])
  const inInspection = useApi(() => api.itemQueue('IN_INSPECTION'), [])
  const graded = useApi(() => (staff ? api.itemQueue('GRADED') : Promise.resolve([])), [staff])

  // The session arrives after the first render, so the open queue is derived
  // rather than stored — a technician must never land on a tab that is not there.
  const allowed: Queue[] = staff ? ['intake', 'inspect', 'price'] : ['inspect']
  const active = allowed.includes(queue) ? queue : allowed[0]

  const counts = {
    intake: pending.data?.length ?? 0,
    inspect: (received.data?.length ?? 0) + (inInspection.data?.length ?? 0),
    price: graded.data?.length ?? 0,
  }

  return (
    <div className="ops">
      <h1 className="ops__title">Operations</h1>

      <nav className="ops__tabs" aria-label="Work queues">
        {staff && <Tab active={active === 'intake'} onClick={() => setQueue('intake')} label="Intake" count={counts.intake} />}
        <Tab active={active === 'inspect'} onClick={() => setQueue('inspect')} label="Inspection" count={counts.inspect} />
        {staff && <Tab active={active === 'price'} onClick={() => setQueue('price')} label="Pricing" count={counts.price} />}
      </nav>

      {active === 'intake' && <IntakeQueue state={pending} />}
      {active === 'inspect' && <InspectQueue received={received} inProgress={inInspection} />}
      {active === 'price' && <PricingQueue state={graded} />}
    </div>
  )
}

function Tab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" className={`ops__tab${active ? ' ops__tab--active' : ''}`} onClick={onClick}>
      {label}
      <span className="ops__tab-count">{count}</span>
    </button>
  )
}

/** Pre-approve, issue the label, mark in transit, then receive into a bin. */
function IntakeQueue({ state }: { state: ReturnType<typeof useApi<any>> }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  if (state.loading) return <Loading label="Loading submissions" />
  if (state.error) return <ErrorNote error={state.error} onRetry={state.reload} />
  const rows = state.data ?? []
  if (rows.length === 0) return <Empty title="Nothing waiting on pre-approval" />

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setError(null)
    try { await fn(); state.reload() } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(null) }
  }

  return (
    <div className="ops__list">
      {error && <p className="ops__error" role="alert">{error}</p>}
      {rows.map((s: any) => (
        <article key={s.id} className="ops__card tg-card">
          <header className="ops__card-head">
            <div>
              <span className="tg-mono">{s.id.slice(0, 8)}</span>
              <span className="tg-badge">{s.pricingMode}</span>
            </div>
            <span className="tg-muted">submitted {dateOnly(s.submittedAt)}</span>
          </header>

          <SubmissionItems submissionId={s.id} />

          <div className="ops__actions">
            <button
              className="tg-button tg-button--primary"
              disabled={busy === s.id}
              onClick={() => act(s.id, () => api.preApprove(s.id, 'bluedart'))}
            >
              Pre-approve and issue label
            </button>
            <button
              className="tg-button ops__reject"
              disabled={busy === s.id}
              onClick={() => setOpen(open === s.id ? null : s.id)}
            >
              Reject
            </button>
          </div>

          {open === s.id && (
            <div className="ops__reject-box">
              {['insufficient_detail', 'prohibited_item', 'price_unrealistic'].map((r) => (
                <button
                  key={r}
                  className="tg-button"
                  disabled={busy === s.id}
                  onClick={() => act(s.id, () => api.rejectSubmission(s.id, r))}
                >
                  {r.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
      <ShipmentsAwaitingIntake />
    </div>
  )
}

function SubmissionItems({ submissionId }: { submissionId: string }) {
  const view = useApi(() => api.submission(submissionId), [submissionId])
  if (!view.data) return null
  return (
    <ul className="ops__items">
      {view.data.items.map((i) => (
        <li key={i.id}>
          <span className="tg-mono">{i.internalSku}</span>
          <span>declared {i.declaredGradeCode}</span>
          <span>asking {money(i.askingAmountMinor)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Shipments that were pre-approved and still need receiving. */
function ShipmentsAwaitingIntake() {
  const inTransit = useApi(() => api.itemQueue('IN_TRANSIT_INBOUND'), [])
  const preApproved = useApi(() => api.itemQueue('PRE_APPROVED'), [])
  const bins = useApi(() => api.storageBins(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const waiting = [...(preApproved.data ?? []), ...(inTransit.data ?? [])]
  if (waiting.length === 0) return null

  const bySubmission = new Map<string, typeof waiting>()
  for (const i of waiting) {
    bySubmission.set(i.submissionId, [...(bySubmission.get(i.submissionId) ?? []), i])
  }

  async function receiveFor(submissionId: string) {
    setBusy(submissionId); setError(null)
    try {
      const shipments = await api.submissionShipments(submissionId)
      const shipment = shipments[0]
      if (!shipment) throw new Error('No inbound shipment for this submission')
      if (shipment.state === 'label_issued') await api.markInTransit(shipment.id)
      await api.receive(shipment.id, { outcomes: {}, binCode: bins.data?.[0]?.code ?? null })
      preApproved.reload(); inTransit.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="tg-card ops__card">
      <h2 className="ops__subtitle">Inbound — waiting to be received</h2>
      {error && <p className="ops__error" role="alert">{error}</p>}
      {[...bySubmission.entries()].map(([sid, items]) => (
        <div key={sid} className="ops__inbound">
          <div>
            <span className="tg-mono">{sid.slice(0, 8)}</span>
            <span className="tg-muted"> · {items.length} item{items.length === 1 ? '' : 's'}</span>
            <StateBadge state={items[0].currentState} />
          </div>
          <button
            className="tg-button tg-button--primary"
            disabled={busy === sid}
            onClick={() => receiveFor(sid)}
          >
            {busy === sid ? 'Receiving…' : `Receive into ${bins.data?.[0]?.code ?? 'a bin'}`}
          </button>
        </div>
      ))}
    </section>
  )
}

function InspectQueue({
  received, inProgress,
}: { received: ReturnType<typeof useApi<any>>; inProgress: ReturnType<typeof useApi<any>> }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (received.loading || inProgress.loading) return <Loading label="Loading inspection queue" />
  const waiting = received.data ?? []
  const open = inProgress.data ?? []
  if (waiting.length === 0 && open.length === 0) return <Empty title="Nothing to inspect" />

  async function start(itemId: string) {
    setBusy(itemId); setError(null)
    try {
      await api.startInspection(itemId)
      received.reload(); inProgress.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start')
    } finally { setBusy(null) }
  }

  return (
    <div className="ops__list">
      {error && <p className="ops__error" role="alert">{error}</p>}

      {open.length > 0 && (
        <section className="tg-card ops__card">
          <h2 className="ops__subtitle">In progress</h2>
          {open.map((i: any) => (
            <div key={i.id} className="ops__inbound">
              <span className="tg-mono">{i.internalSku}</span>
              <Link className="tg-button tg-button--primary" to={`/ops/inspect/${i.id}`}>Continue</Link>
            </div>
          ))}
        </section>
      )}

      {waiting.length > 0 && (
        <section className="tg-card ops__card">
          <h2 className="ops__subtitle">Received, not yet inspected</h2>
          {waiting.map((i: any) => (
            <div key={i.id} className="ops__inbound">
              <div>
                <span className="tg-mono">{i.internalSku}</span>
                <span className="tg-muted"> · declared {i.declaredGradeCode}</span>
              </div>
              <button className="tg-button tg-button--primary" disabled={busy === i.id} onClick={() => start(i.id)}>
                {busy === i.id ? 'Starting…' : 'Start inspection'}
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

/** Graded items waiting on a price. */
function PricingQueue({ state }: { state: ReturnType<typeof useApi<any>> }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [override, setOverride] = useState<Record<string, string>>({})
  const [result, setResult] = useState<string | null>(null)

  if (state.loading) return <Loading label="Loading pricing queue" />
  if (state.error) return <ErrorNote error={state.error} onRetry={state.reload} />
  const rows = state.data ?? []
  if (rows.length === 0) return <Empty title="Nothing waiting on a price" />

  async function price(itemId: string, amount?: number) {
    setBusy(itemId); setError(null); setResult(null)
    try {
      const outcome = await api.propose(itemId, {
        staffAmountMinor: amount ?? null,
        staffOverrideReason: amount ? 'Priced off comparable recent sales' : null,
      })
      setResult(
        outcome.listing
          ? 'Listed straight away — it met the seller\'s floor.'
          : 'Sent to the seller to approve.',
      )
      state.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not price that')
    } finally { setBusy(null) }
  }

  return (
    <div className="ops__list">
      {error && <p className="ops__error" role="alert">{error}</p>}
      {result && <p className="ops__result">{result}</p>}
      {rows.map((i: any) => (
        <article key={i.id} className="ops__card tg-card">
          <header className="ops__card-head">
            <div>
              <span className="tg-mono">{i.internalSku}</span>
              <span className="tg-badge tg-badge--accent">{i.assignedGradeCode}</span>
            </div>
            <span className="tg-muted">
              declared {i.declaredGradeCode} · asking {money(i.askingAmountMinor)}
              {i.floorAmountMinor != null && ` · floor ${money(i.floorAmountMinor)}`}
            </span>
          </header>
          <div className="ops__actions">
            <button className="tg-button tg-button--primary" disabled={busy === i.id} onClick={() => price(i.id)}>
              Use the guided price
            </button>
            <div className="ops__override">
              <input
                className="tg-input ops__override-input"
                type="number"
                min={1}
                placeholder="Override (₹)"
                value={override[i.id] ?? ''}
                onChange={(e) => setOverride({ ...override, [i.id]: e.target.value })}
              />
              <button
                className="tg-button"
                disabled={busy === i.id || !Number(override[i.id])}
                onClick={() => price(i.id, Math.round(Number(override[i.id]) * 100))}
              >
                Price manually
              </button>
            </div>
          </div>
          <p className="tg-muted ops__fineprint">
            Pricing takes the fee snapshot. It is what the payout will read, whatever the fee table says later.
          </p>
        </article>
      ))}
    </div>
  )
}
