import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, dateTime, money, useApi, type InsuranceQueueRow } from '@trueglaz/core'
import { Empty, ErrorNote, Loading } from '../components/ui'
import './OpsPage.css'
import './InsuranceDeskPage.css'

const PLAN_LABEL: Record<string, string> = { standard: 'Standard', plus: 'Plus' }

/**
 * The insurance desk: cover an owner asked for in their Gear Vault, waiting to
 * be issued by hand.
 *
 * The owner's premium is authorised, not charged. Issuing captures it and gives
 * the owner a policy; declining voids it and tells them why. Until a partner's
 * API issues policies instantly, nothing leaves this queue without a person.
 */
export function InsuranceDeskPage() {
  const queue = useApi(() => api.insuranceQueue(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function act(id: string, fn: () => Promise<unknown>, message: string) {
    setBusy(id); setError(null); setDone(null)
    try { await fn(); setDone(message); queue.reload() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'That did not work') }
    finally { setBusy(null) }
  }

  if (queue.loading) return <Loading label="Loading cover requests" />
  if (queue.error) return <ErrorNote error={queue.error} onRetry={queue.reload} />

  const rows = queue.data ?? []
  const fresh = rows.filter((r) => r.status === 'authorized')
  const withInsurer = rows.filter((r) => r.status === 'submitted')
  const overdue = rows.filter((r) => r.overdue).length

  return (
    <div className="ops">
      <h1 className="ops__title">Insurance desk</h1>
      <p className="tg-muted ops__fineprint">
        Cover owners asked for in their Gear Vault. The premium is authorised, not charged: issuing charges it,
        declining releases it and the owner is told why.
        {overdue > 0 && <strong className="ops__error"> {overdue} past the promised date.</strong>}
      </p>
      {error && <p className="ops__error" role="alert">{error}</p>}
      {done && <p className="tg-muted" role="status">{done}</p>}
      {rows.length === 0 && <Empty title="No cover waiting" hint="A request appears here when an owner insures gear in their vault." />}

      <Stage title="New — send to the insurer" rows={fresh}
        blurb="Mark it sent once it is with the insurer, or issue straight away if you already have the policy."
        render={(r) => <Actions row={r} busy={busy === r.id} act={act} canSend />} />
      <Stage title="With the insurer — issue or decline" rows={withInsurer}
        blurb="Enter the insurer's policy number when it comes back."
        render={(r) => <Actions row={r} busy={busy === r.id} act={act} />} />
    </div>
  )
}

function Stage({ title, blurb, rows, render }: {
  title: string; blurb: string; rows: InsuranceQueueRow[]; render: (r: InsuranceQueueRow) => React.ReactNode
}) {
  if (rows.length === 0) return null
  return (
    <section className="tg-card ops__card">
      <h2 className="ops__subtitle">{title} ({rows.length})</h2>
      <p className="tg-muted ops__fineprint">{blurb}</p>
      {rows.map((r) => (
        <div key={r.id} className="ops__inbound">
          <div>
            <strong>{r.modelLabel}</strong>
            <span className="tg-muted"> · {PLAN_LABEL[r.planCode] ?? r.planCode} · covers {money(r.sumInsuredMinor)} · premium {money(r.totalMinor)}</span>
            <br />
            <span className="tg-muted">
              <Link to={`/admin/people/${r.userId}`}>{r.ownerName ?? 'Owner'}</Link>
              {r.requestedAt && ` · asked ${dateTime(r.requestedAt)}`}
              {r.slaDueAt && ' · due '}
            </span>
            {r.slaDueAt && (r.overdue
              ? <strong className="ops__error" style={{ display: 'inline' }}>{dateTime(r.slaDueAt)} — overdue</strong>
              : <span className="tg-muted">{dateTime(r.slaDueAt)}</span>)}
          </div>
          <span>{render(r)}</span>
        </div>
      ))}
    </section>
  )
}

type Act = (id: string, fn: () => Promise<unknown>, message: string) => void

function Actions({ row, busy, act, canSend = false }: { row: InsuranceQueueRow; busy: boolean; act: Act; canSend?: boolean }) {
  const [mode, setMode] = useState<null | 'issue' | 'decline'>(null)
  const [insurer, setInsurer] = useState('')
  const [policyNo, setPolicyNo] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [reason, setReason] = useState('')

  if (mode === 'issue') {
    return (
      <span className="desk__form">
        <label className="desk__field"><span>Insurer</span>
          <input className="tg-input" value={insurer} onChange={(e) => setInsurer(e.target.value)} autoFocus /></label>
        <label className="desk__field"><span>Policy no. <em>blank = we make one</em></span>
          <input className="tg-input" value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} /></label>
        <label className="desk__field"><span>Cover starts <em>blank = today, 1 year</em></span>
          <input className="tg-input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} /></label>
        <span className="desk__buttons">
          <button className="tg-button tg-button--primary" disabled={busy || !insurer.trim()}
            onClick={() => act(row.id, () => api.insuranceIssue(row.id, {
              insurerName: insurer.trim(), policyNo: policyNo.trim() || null, startsOn: startsOn || null,
            }), `Issued — ${money(row.totalMinor)} charged and the owner told.`)}>
            Issue &amp; charge {money(row.totalMinor)}
          </button>
          <button className="tg-button" onClick={() => setMode(null)}>Back</button>
        </span>
      </span>
    )
  }
  if (mode === 'decline') {
    return (
      <span className="desk__form">
        <label className="desk__field desk__field--wide"><span>Reason <em>the owner reads this</em></span>
          <input className="tg-input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></label>
        <span className="desk__buttons">
          <button className="tg-button tg-button--primary" disabled={busy || !reason.trim()}
            onClick={() => act(row.id, () => api.insuranceDecline(row.id, reason.trim()), 'Declined — nothing charged, the owner was told why.')}>
            Decline, charge nothing
          </button>
          <button className="tg-button" onClick={() => setMode(null)}>Back</button>
        </span>
      </span>
    )
  }
  return (
    <span className="ops__inbound-actions">
      {canSend && (
        <button className="tg-button" disabled={busy}
          onClick={() => act(row.id, () => api.insuranceSubmit(row.id), 'Marked as sent to the insurer.')}>
          Mark sent
        </button>
      )}
      <button className="tg-button tg-button--primary" disabled={busy} onClick={() => setMode('issue')}>Issue policy</button>
      <button className="tg-button tg-button--subtle" disabled={busy} onClick={() => setMode('decline')}>Decline</button>
    </span>
  )
}
