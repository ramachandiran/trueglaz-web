import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api, ApiError, dateTime, isAdmin, isStaff, isTechnician, money, useApi, useSession,
  type ReturnCaseView,
} from '@trueglaz/core'
import { Empty, ErrorNote, Loading } from '../components/ui'
import './OpsPage.css'

const REASON_LABELS: Record<string, string> = {
  not_as_described: 'Not as described',
  damaged_in_transit: 'Damaged in transit',
  wrong_item: 'Wrong item received',
  change_of_mind: 'Changed their mind',
}

/**
 * Returns, in the order a return moves.
 *
 * A return is a person with a parcel and money attached, so each stage shows
 * only the one decision that belongs to it and only to the role that makes it:
 * staff approve or decline and receive and decide the refund, a technician does
 * the bench check, and what staff refused lands with an admin.
 */
export function ReturnsPage() {
  const { session } = useSession()
  const staff = isStaff(session)
  const tech = isTechnician(session)
  const admin = isAdmin(session)
  const all = useApi(() => api.returns(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setError(null)
    try { await fn(); all.reload() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'That did not work') }
    finally { setBusy(null) }
  }

  if (all.loading) return <Loading label="Loading returns" />
  if (all.error) return <ErrorNote error={all.error} onRetry={all.reload} />

  const rows = all.data ?? []
  const by = (s: string) => rows.filter((r) => r.case.state === s)
  const open = ['requested', 'approved', 'received', 'inspected', 'escalated']
  const closed = rows.filter((r) => !open.includes(r.case.state))

  return (
    <div className="ops">
      <h1 className="ops__title">Returns</h1>
      {error && <p className="ops__error" role="alert">{error}</p>}
      {rows.length === 0 && <Empty title="No returns" hint="A buyer's request appears here for review." />}

      <Stage
        title="Asked for — approve or decline" rows={by('requested')} show={staff}
        blurb="Approving sends the buyer a return label. Declining closes the sale; give a reason, the buyer reads it."
        render={(r) => <RequestActions row={r} busy={busy === r.orderLineId} act={act} />}
      />
      <Stage
        title="On its way back" rows={by('approved')} show={staff}
        blurb="Mark it received when the parcel arrives."
        render={(r) => (
          <button className="tg-button tg-button--primary" disabled={busy === r.orderLineId} onClick={() => act(r.orderLineId, () => api.returnReceive(r.orderLineId))}>
            Mark received
          </button>
        )}
      />
      <Stage
        title="Received — check it" rows={by('received')} show={tech}
        blurb="Is it the same unit, in the condition it left in, with what it left with?"
        render={(r) => <BenchCheck row={r} busy={busy === r.orderLineId} act={act} />}
      />
      <Stage
        title="Checked — decide" rows={by('inspected')} show={staff}
        blurb="Refund relists the unit and cancels the sale; the buyer's money shows under Refunds due. Refusing sends it to an admin."
        render={(r) => <Decide row={r} busy={busy === r.orderLineId} act={act} />}
      />
      <Stage
        title="Refused — an admin decides" rows={by('escalated')} show={admin}
        blurb="Refund anyway sends the unit home to the seller. Let the sale stand sends it back to the buyer and pays the seller."
        render={(r) => <AdminClose row={r} busy={busy === r.orderLineId} act={act} />}
      />

      {closed.length > 0 && (
        <section className="tg-card ops__card">
          <h2 className="ops__subtitle">Settled ({closed.length})</h2>
          {closed.map((r) => (
            <div key={r.orderLineId} className="ops__inbound">
              <Summary row={r} />
              <span className="tg-badge">{r.case.state.replace('_', ' ')}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function Stage({ title, blurb, rows, show, render }: {
  title: string; blurb: string; rows: ReturnCaseView[]; show: boolean
  render: (r: ReturnCaseView) => React.ReactNode
}) {
  // Someone who cannot act on a stage still sees it exists, but not as a to-do.
  if (rows.length === 0) return null
  return (
    <section className="tg-card ops__card">
      <h2 className="ops__subtitle">{title} ({rows.length})</h2>
      <p className="tg-muted ops__fineprint">{blurb}</p>
      {rows.map((r) => (
        <div key={r.orderLineId} className="ops__inbound">
          <Summary row={r} />
          <span>{show ? render(r) : <span className="tg-muted">Waiting on someone else</span>}</span>
        </div>
      ))}
    </section>
  )
}

function Summary({ row }: { row: ReturnCaseView }) {
  const c = row.case
  const f = c.inspection
  return (
    <div>
      <span className="tg-mono">{row.orderNumber}</span>{' '}
      <Link to={`/items/${c.consignmentItemId}`} className="tg-mono">{row.itemSku}</Link>
      <span className="tg-muted"> {row.itemLabel} · {money(row.amountMinor)} · {row.buyerName ?? 'buyer'} · asked {dateTime(c.requestedAt)}</span>
      <br />
      <strong>{REASON_LABELS[c.reasonCode] ?? c.reasonCode}</strong>
      {c.buyerNote && <span> — “{c.buyerNote}”</span>}
      {f && (
        <div className="tg-muted">
          Bench: serial {f.serialMatches ? 'matches' : 'DOES NOT match'} · condition {f.conditionOk ? 'ok' : 'WORSE'} ·
          accessories {f.accessoriesOk ? 'complete' : 'MISSING'}{f.note ? ` — ${f.note}` : ''}
        </div>
      )}
      {c.resolutionNote && <div className="tg-muted">Staff: {c.resolutionNote}</div>}
    </div>
  )
}

type Act = (id: string, fn: () => Promise<unknown>) => void

function RequestActions({ row, busy, act }: { row: ReturnCaseView; busy: boolean; act: Act }) {
  const [mode, setMode] = useState<null | 'approve' | 'decline'>(null)
  const [courier, setCourier] = useState('bluedart')
  const [tracking, setTracking] = useState('')
  const [note, setNote] = useState('')
  if (!mode) {
    return (
      <span style={{ display: 'flex', gap: 8 }}>
        <button className="tg-button tg-button--primary" onClick={() => setMode('approve')}>Approve</button>
        <button className="tg-button" onClick={() => setMode('decline')}>Decline</button>
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {mode === 'approve' ? (
        <>
          <input className="tg-input" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Courier" style={{ width: 110 }} />
          <input className="tg-input" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking (if known)" />
          <button className="tg-button tg-button--primary" disabled={busy} onClick={() => act(row.orderLineId, () => api.returnApprove(row.orderLineId, courier, tracking))}>Send label</button>
        </>
      ) : (
        <>
          <input className="tg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason the buyer will read" style={{ minWidth: 260 }} />
          <button className="tg-button tg-button--primary" disabled={busy || note.trim().length < 10} onClick={() => act(row.orderLineId, () => api.returnDecline(row.orderLineId, note))}>Decline</button>
        </>
      )}
      <button className="tg-button" onClick={() => setMode(null)}>Back</button>
    </span>
  )
}

function BenchCheck({ row, busy, act }: { row: ReturnCaseView; busy: boolean; act: Act }) {
  const [serial, setSerial] = useState(true)
  const [cond, setCond] = useState(true)
  const [acc, setAcc] = useState(true)
  const [note, setNote] = useState('')
  const bad = !serial || !cond || !acc
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <label><input type="checkbox" checked={serial} onChange={(e) => setSerial(e.target.checked)} /> Serial matches</label>
      <label><input type="checkbox" checked={cond} onChange={(e) => setCond(e.target.checked)} /> Condition as it left</label>
      <label><input type="checkbox" checked={acc} onChange={(e) => setAcc(e.target.checked)} /> Accessories complete</label>
      <input className="tg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={bad ? 'What was wrong (required)' : 'Note (optional)'} style={{ minWidth: 260 }} />
      <button
        className="tg-button tg-button--primary"
        disabled={busy || (bad && note.trim().length < 10)}
        onClick={() => act(row.orderLineId, () => api.returnInspect(row.orderLineId, { serialMatches: serial, conditionOk: cond, accessoriesOk: acc, note }))}
      >
        Record check
      </button>
    </span>
  )
}

function Decide({ row, busy, act }: { row: ReturnCaseView; busy: boolean; act: Act }) {
  const f = row.case.inspection
  const canRefund = !!f?.serialMatches && !!f?.conditionOk
  const [note, setNote] = useState('')
  return (
    <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <input className="tg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required to refuse)" style={{ minWidth: 240 }} />
      <button
        className="tg-button tg-button--primary" disabled={busy || !canRefund}
        title={canRefund ? undefined : 'The bench check failed; refuse it and an admin will decide'}
        onClick={() => act(row.orderLineId, () => api.returnResolve(row.orderLineId, 'refund', note))}
      >
        Refund and relist
      </button>
      <button className="tg-button" disabled={busy || note.trim().length < 10} onClick={() => act(row.orderLineId, () => api.returnResolve(row.orderLineId, 'reject', note))}>
        Refuse
      </button>
    </span>
  )
}

function AdminClose({ row, busy, act }: { row: ReturnCaseView; busy: boolean; act: Act }) {
  const [note, setNote] = useState('')
  const ok = note.trim().length >= 10
  return (
    <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <input className="tg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why (required)" style={{ minWidth: 240 }} />
      <button className="tg-button" disabled={busy || !ok} onClick={() => act(row.orderLineId, () => api.returnClose(row.orderLineId, 'refund', note))}>
        Refund anyway
      </button>
      <button className="tg-button tg-button--primary" disabled={busy || !ok} onClick={() => act(row.orderLineId, () => api.returnClose(row.orderLineId, 'sale_stands', note))}>
        Sale stands
      </button>
    </span>
  )
}
