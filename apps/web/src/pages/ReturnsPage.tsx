import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api, ApiError, dateTime, isAdmin, isStaff, isTechnician, money, useApi, useSession,
  type ReturnCaseView,
} from '@trueglaz/core'
import { ModelPhoto } from '../components/ModelPhoto'
import { QueueScreen } from '../components/QueueScreen'
import { KpiCard, KpiRow } from '../components/KpiCard'
import { Icon, ICONS } from '../components/StaffShell'
import { useQueryState } from '../components/useQueryState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FactGrid, PanelSection, SidePanel } from '../components/SidePanel'
import { LineHistory } from '../components/LineHistory'
import { COURIER_CHOICES, courierName } from '../components/couriers'
import './OpsPage.css'
import './FulfilmentPage.css'

const REASON_LABELS: Record<string, string> = {
  not_as_described: 'Not as described',
  damaged_in_transit: 'Damaged in transit',
  wrong_item: 'Wrong item received',
  change_of_mind: 'Changed their mind',
  cancelled_in_transit: 'Cancelled while in transit',
}

type Tab = 'requested' | 'approved' | 'received' | 'inspected' | 'escalated' | 'settled'

const SETTLED = ['refunded', 'declined', 'sale_stands']

/**
 * Returns, in the order a return moves, in the same frame as Operations (TG-86).
 *
 * A return is a person with a parcel and money attached, so each stage shows
 * only the one decision that belongs to it and only to the role that makes it:
 * staff watch the buyer's unboxing video and approve or decline (TG-90), receive
 * the parcel and decide the refund; a technician does the bench check; what
 * staff refused lands with an admin. Every row opens its full history (TG-91).
 */
export function ReturnsPage() {
  const { session } = useSession()
  const staff = isStaff(session)
  const tech = isTechnician(session)
  const admin = isAdmin(session)
  const all = useApi(() => api.returns(), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Tab and search in the address, so a Control room count opens its queue (TG-126).
  // A technician's only part in a return is the bench check (TG-169), so that
  // is all they see; staff and admins keep every stage.
  const benchOnly = tech && !staff
  const [tabParam, setTabParam] = useQueryState('tab', benchOnly ? 'received' : 'requested')
  const tab = tabParam as Tab
  const setTab = (t: Tab) => setTabParam(t)
  const [search, setSearch] = useQueryState('q')
  const [page, setPage] = useState(1)
  // TG-205: a return opens as a record over the queue, linkable like the Insurance desk.
  const [openParam, setOpenParam] = useQueryState('open')
  const open = openParam || null
  const setOpen = (id: string | null) => setOpenParam(id ?? '')
  const [video, setVideo] = useState<ReturnCaseView | null>(null)
  const [done, setDone] = useState(0)
  const perPage = 25

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setError(null)
    try { await fn(); all.reload(); setDone((n) => n + 1) }
    catch (e) { setError(e instanceof ApiError ? e.message : 'That did not work') }
    finally { setBusy(null) }
  }

  const rows = all.data ?? []
  const inState = (t: Tab) => rows.filter((r) => (t === 'settled' ? SETTLED.includes(r.case.state) : r.case.state === t))
  const stages: { key: Tab; label: string; show: boolean; blurb: string }[] = [
    { key: 'requested', label: 'To review', show: staff, blurb: 'Watch the unboxing video. Approving sends the buyer a pickup; declining closes the sale like any delivered one — give a reason, the buyer reads it.' },
    { key: 'approved', label: 'On its way back', show: staff, blurb: 'Mark it received when the parcel arrives.' },
    { key: 'received', label: 'To check', show: tech, blurb: 'Is it the same unit, in the condition it left in, with what it left with?' },
    { key: 'inspected', label: 'To decide', show: staff, blurb: 'Refund relists the unit and cancels the sale; the buyer’s money shows under Refunds due. Refusing sends it to an admin.' },
    { key: 'escalated', label: 'Admin', show: admin, blurb: 'Refund anyway sends the unit home to the seller. Sale stands sends it back to the buyer and pays the seller.' },
    { key: 'settled', label: 'Settled', show: true, blurb: '' },
  ]
  const visible = benchOnly ? stages.filter((s) => s.key === 'received' || s.key === 'settled') : stages
  const stage = stages.find((s) => s.key === tab)!
  const inTab = inState(tab)
  // One card per stage that needs a person (TG-199); Settled is history, so it stays a tab only.
  const kpis = visible.filter((v) => v.key !== 'settled')
  const filtered = inTab.filter((r) => {
    const t = search.trim().toLowerCase()
    if (!t) return true
    return [r.orderNumber, r.itemSku, r.itemLabel, r.buyerName, r.case.buyerNote].some((v) => v?.toLowerCase().includes(t))
  })
  const pages = Math.ceil(filtered.length / perPage)
  const p = Math.min(Math.max(1, page), pages || 1)
  const shown = filtered.slice((p - 1) * perPage, p * perPage)

  const render = (r: ReturnCaseView) => {
    const b = busy === r.orderLineId
    switch (r.case.state) {
      case 'requested': return <RequestActions row={r} busy={b} act={act} />
      case 'approved': return (
        <button className="tg-button tg-button--primary" disabled={b} onClick={() => act(r.orderLineId, () => api.returnReceive(r.orderLineId))}>
          Mark received
        </button>
      )
      case 'received': return <BenchCheck row={r} busy={b} act={act} />
      case 'inspected': return <Decide row={r} busy={b} act={act} />
      case 'escalated': return <AdminClose row={r} busy={b} act={act} />
      default: return <span className="tg-badge">{r.case.state.replace('_', ' ')}</span>
    }
  }

  return (
    <>
      <QueueScreen
        title="Returns"
        subtitle="Every return from the buyer’s request to the refund, with the unboxing video and a full history."
        tabs={visible.map((s) => ({ key: s.key, label: s.label, count: inState(s.key).length }))}
        active={tab}
        onTab={(k) => { setTab(k as Tab); setPage(1); setError(null) }}
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by order, SKU, item, buyer or note…"
        shown={filtered.length}
        total={inTab.length}
        unit="returns"
        loading={all.loading && !all.data}
        error={all.error}
        onRetry={all.reload}
        emptyTitle={tab === 'settled' ? 'No settled returns yet' : 'Nothing at this stage'}
        emptyHint="That is the queue being empty, not the page being broken."
        page={p}
        pages={pages}
        onPage={setPage}
        crumbs={[{ label: 'Control room', to: '/admin' }, { label: 'Returns' }]}
        summary={(
          <>
            {kpis.length > 0 && (
              <KpiRow label="Returns by stage" cols={kpis.length === 3 ? 3 : kpis.length >= 5 ? 5 : undefined}>
                {kpis.map((k, i) => {
                  const n = inState(k.key).length
                  const value = inState(k.key).reduce((m, r) => m + (r.amountMinor ?? 0), 0)
                  const hot = k.key === 'escalated' || (k.key === 'requested' && n > 0)
                  return (
                    <KpiCard key={k.key} icon={RET_ICON[k.key] ?? ICONS.returns} lead={i === 0} title={k.label} value={n}
                      pressed={tab === k.key} onClick={() => { setTab(k.key as Tab); setPage(1); setError(null) }}
                      tone={k.key === 'escalated' && n > 0 ? 'bad' : undefined}
                      chip={n > 0 && hot ? (k.key === 'escalated'
                        ? <span className="c-chip2 c-chip2--bad"><Icon d={ICONS.alert} /> Needs an admin</span>
                        : <span className="c-chip2 c-chip2--bad"><Icon d={ICONS.clock} /> Buyer's clock stopped</span>) : undefined}
                      note={n > 0 ? `${money(value)} of sales` : 'nothing here'} />
                  )
                })}
              </KpiRow>
            )}
            {stage.blurb && <p className="tg-muted ops__fineprint ret__blurb">{stage.blurb}</p>}
            {error && <p className="ops__error" role="alert">{error}</p>}
          </>
        )}
      >
        <table className="q__table ful ret__rows">
          <thead>
            <tr>
              <th>Item</th>
              <th>Order</th>
              <th>Reason</th>
              <th>Asked</th>
              <th className="ful__act">Next</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.orderLineId} className="ret__row" onClick={() => setOpen(r.orderLineId)}>
                <td><Summary row={r} /></td>
                <td>
                  <div className="tg-mono">{r.orderNumber}</div>
                  <div className="tg-muted ful__small">{r.buyerName ?? 'Buyer'} · {money(r.amountMinor)}</div>
                </td>
                <td className="ful__small ret__reason">
                  <strong>{REASON_LABELS[r.case.reasonCode] ?? r.case.reasonCode}</strong>
                  {r.video && <div className="tg-muted">Unboxing video sent</div>}
                </td>
                <td className="ful__small tg-muted">{dateTime(r.case.requestedAt)}</td>
                <td className="ful__act">
                  <button type="button" className="c-btn c-btn--sm" aria-label={`Open the return for ${r.orderNumber}`}
                    onClick={(e) => { e.stopPropagation(); setOpen(r.orderLineId) }}>
                    {stage.show && tab !== 'settled' ? 'Review' : 'Open'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </QueueScreen>
      {(() => {
        const r = open ? rows.find((x) => x.orderLineId === open) : undefined
        if (!r) return null
        const mine = stages.find((x) => x.key === (SETTLED.includes(r.case.state) ? 'settled' : r.case.state))
        const f = r.case.inspection
        return (
          <SidePanel open onClose={() => setOpen(null)} eyebrow={`Return · ${r.orderNumber}`} title={r.itemLabel}
            subtitle={<>{r.buyerName ?? 'Buyer'} · {money(r.amountMinor)} · asked {dateTime(r.case.requestedAt)}</>}
            badges={<span className={`c-chip2 c-chip2--${r.case.state === 'escalated' ? 'bad' : SETTLED.includes(r.case.state) ? 'good' : 'warn'}`}>{mine?.label ?? r.case.state.replace('_', ' ')}</span>}
            footer={<Link className="c-btn c-btn--sm" to={`/items/${r.case.consignmentItemId}`}>Open the unit {r.itemSku}</Link>}>
            <PanelSection title="What the buyer said" tone="card">
              <FactGrid facts={[
                { label: 'Reason', value: REASON_LABELS[r.case.reasonCode] ?? r.case.reasonCode },
                { label: 'Unboxing video', value: r.video
                  ? <button type="button" className="c-btn c-btn--sm" onClick={() => setVideo(r)}>▶ Watch</button>
                  : r.case.reasonCode === 'cancelled_in_transit' ? 'Recalled from the courier' : 'None (raised before it was required)' },
                ...(r.case.buyerNote ? [{ label: 'In their words', value: `“${r.case.buyerNote}”`, wide: true }] : []),
              ]} />
            </PanelSection>
            {(f || r.case.decisionNote || r.case.resolutionNote) && (
              <PanelSection title="What we found" tone="card">
                <FactGrid facts={[
                  ...(f ? [
                    { label: 'Serial', value: f.serialMatches ? 'Matches' : 'Does not match' },
                    { label: 'Condition', value: f.conditionOk ? 'As it left' : 'Worse than it left' },
                    { label: 'Accessories', value: f.accessoriesOk ? 'Complete' : 'Missing' },
                    ...(f.note ? [{ label: 'Bench note', value: f.note, wide: true }] : []),
                  ] : []),
                  ...(r.case.decisionNote ? [{ label: 'Declined because', value: r.case.decisionNote, wide: true }] : []),
                  ...(r.case.resolutionNote ? [{ label: 'Staff note', value: r.case.resolutionNote, wide: true }] : []),
                ]} />
              </PanelSection>
            )}
            {!SETTLED.includes(r.case.state) && (
              <PanelSection title="Your decision" tone="card">
                {mine?.blurb && <p className="tg-muted ful__small ret__panel-blurb">{mine.blurb}</p>}
                {mine?.show ? <div className="ret__panel-act">{render(r)}</div> : <p className="tg-muted ful__small">This stage belongs to another role.</p>}
                {error && <p className="ops__error" role="alert">{error}</p>}
              </PanelSection>
            )}
            <PanelSection title="History">
              <LineHistory lineId={r.orderLineId} staff refreshKey={done} />
            </PanelSection>
          </SidePanel>
        )
      })()}
      {video && <VideoDialog row={video} onClose={() => setVideo(null)} />}
    </>
  )
}

/** The buyer's unboxing video, played in the console. Opening it is audited by the API. */
function VideoDialog({ row, onClose }: { row: ReturnCaseView; onClose: () => void }) {
  const link = useApi(() => api.returnVideoLink(row.video!.id), [row.video!.id])
  return (
    <ConfirmDialog open title={`Unboxing video · ${row.orderNumber}`} confirmLabel="Done" onConfirm={onClose} onCancel={onClose}>
      <div className="ret__review">
        {link.loading && <p className="tg-muted">Loading the video…</p>}
        {link.error && <p className="ops__error">Could not load the video.</p>}
        {link.data && (
          <>
            <video className="ret__player" src={link.data.url} controls playsInline preload="metadata" />
            <p className="tg-muted ful__small">
              {row.video!.fileName ?? 'video'} · {row.video!.bytes < 1048576 ? `${Math.max(1, Math.round(row.video!.bytes / 1024))} KB` : `${(row.video!.bytes / 1048576).toFixed(1)} MB`} · sent {dateTime(row.video!.createdAt)}.{' '}
              <a href={link.data.url} target="_blank" rel="noopener noreferrer">Open in a new tab</a>
            </p>
          </>
        )}
        <p className="ful__small"><strong>{REASON_LABELS[row.case.reasonCode] ?? row.case.reasonCode}</strong>{row.case.buyerNote ? ` — “${row.case.buyerNote}”` : ''}</p>
      </div>
    </ConfirmDialog>
  )
}

function Summary({ row }: { row: ReturnCaseView }) {
  const f = row.case.inspection
  return (
    <div className="ful__item">
      <span className="ops__pic"><ModelPhoto modelId={row.productModelId} kind="gear" size="mini" alt="" badge={false} /></span>
      <div>
        <div className="ful__title">{row.itemLabel}</div>
        <Link to={`/items/${row.case.consignmentItemId}`} className="tg-mono ful__sku">{row.itemSku}</Link>
        {f && (
          <div className="tg-muted ful__small">
            Bench: serial {f.serialMatches ? 'matches' : 'DOES NOT match'} · condition {f.conditionOk ? 'ok' : 'WORSE'} ·
            accessories {f.accessoriesOk ? 'complete' : 'MISSING'}{f.note ? ` — ${f.note}` : ''}
          </div>
        )}
      </div>
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
          <select className="tg-select" value={courier} onChange={(e) => setCourier(e.target.value)} aria-label="Pickup courier">
            {COURIER_CHOICES.map((c) => <option key={c} value={c}>{courierName(c)}</option>)}
          </select>
          <input className="tg-input" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking (if known)" />
          <button className="tg-button tg-button--primary" disabled={busy} onClick={() => act(row.orderLineId, () => api.returnApprove(row.orderLineId, courier, tracking))}>Approve and book pickup</button>
        </>
      ) : (
        <>
          <input className="tg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason the buyer will read" style={{ minWidth: 260 }} />
          <button className="tg-button tg-button--primary" disabled={busy || note.trim().length < 10} onClick={() => act(row.orderLineId, () => api.returnDecline(row.orderLineId, note))}>Decline return</button>
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

/** Each stage's icon on its card. */
const RET_ICON: Record<string, string> = {
  requested: ICONS.returns, approved: ICONS.fulfilment, received: ICONS.wrench, inspected: ICONS.check, escalated: ICONS.alert,
}
