import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, dateOnly, dateTime, isAdmin, money, useApi, useSession, type StaffOrderLine } from '@trueglaz/core'
import { QueueScreen } from '../components/QueueScreen'
import { ModelPhoto } from '../components/ModelPhoto'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LineHistory } from '../components/LineHistory'
import { COURIER_CHOICES, courierName } from '../components/couriers'
import './OpsPage.css'
import './FulfilmentPage.css'

type Tab = 'open' | 'dispatched' | 'delivered' | 'closed'

const TABS: { key: Tab; label: string; states: string[] }[] = [
  { key: 'open', label: 'To dispatch', states: ['open', 'packing'] },
  { key: 'dispatched', label: 'In transit', states: ['dispatched'] },
  { key: 'delivered', label: 'Delivered', states: ['delivered'] },
  { key: 'closed', label: 'Closed', states: ['accepted'] },
]

/** Today in India, as the yyyy-mm-dd a date input wants. */
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

type Dialog =
  | { kind: 'dispatch'; line: StaffOrderLine }
  | { kind: 'deliver'; line: StaffOrderLine }
  | { kind: 'tracking'; line: StaffOrderLine }
  | { kind: 'close'; line: StaffOrderLine }

/**
 * Getting sold items to buyers, in the same frame as Operations (TG-86).
 *
 * Every step asks for what the record needs (TG-87, TG-88): dispatch takes the
 * courier, tracking, what the courier charged and a note; delivery takes the
 * date and remarks. The acceptance window starts at delivery, not dispatch, and
 * closing a sale by hand once it has ended is an admin's call (TG-89), because
 * closing releases the seller's money. Each row opens its full history.
 */
export function FulfilmentPage() {
  const { session } = useSession()
  const admin = isAdmin(session)
  const all = useApi(() => api.orderLines(), [])
  const [tab, setTab] = useState<Tab>('open')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [done, setDone] = useState(0)
  const perPage = 10

  const rows = all.data ?? []
  const count = (t: Tab) => rows.filter((l) => TABS.find((x) => x.key === t)!.states.includes(l.state)).length
  const inTab = useMemo(() => {
    const states = TABS.find((x) => x.key === tab)!.states
    return rows.filter((l) => states.includes(l.state)).sort((a, b) => stamp(b) - stamp(a))
  }, [rows, tab])
  const filtered = inTab.filter((l) => {
    const t = search.trim().toLowerCase()
    if (!t) return true
    return [l.orderNumber, l.internalSku, l.title, l.buyerName, l.trackingNumber, courierName(l.courierCode)]
      .some((v) => v?.toLowerCase().includes(t))
  })
  const pages = Math.ceil(filtered.length / perPage)
  const p = Math.min(Math.max(1, page), pages || 1)
  const shown = filtered.slice((p - 1) * perPage, p * perPage)

  const finished = () => { setDialog(null); setDone((n) => n + 1); all.reload() }

  return (
    <>
      <QueueScreen
        title="Fulfilment"
        subtitle="Sold items on their way to buyers. Each step is recorded: who, when, which courier and what it cost."
        tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: count(t.key) }))}
        active={tab}
        onTab={(k) => { setTab(k as Tab); setPage(1); setOpen(null) }}
        search={search}
        onSearch={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Search by order, SKU, item, buyer or tracking…"
        shown={filtered.length}
        total={inTab.length}
        unit="items"
        loading={all.loading && !all.data}
        error={all.error}
        onRetry={all.reload}
        emptyTitle={tab === 'open' ? 'Nothing waiting to be dispatched' : tab === 'dispatched' ? 'Nothing in transit' : tab === 'delivered' ? 'Nothing waiting on a buyer' : 'No closed sales yet'}
        emptyHint="That is the queue being empty, not the page being broken."
        page={p}
        pages={pages}
        onPage={setPage}
      >
        <table className="q__table ful">
          <thead>
            <tr>
              <th>Item</th>
              <th>Order</th>
              <th>Shipment</th>
              <th>{tab === 'closed' ? 'Closed' : 'Updated'}</th>
              <th className="ful__act">Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => (
              <Fragment key={l.id}>
                <tr>
                  <td>
                    <div className="ful__item">
                      <span className="ops__pic"><ModelPhoto modelId={l.productModelId} kind="gear" size="mini" alt="" badge={false} /></span>
                      <div>
                        <div className="ful__title">{l.title?.split('·')[0].trim() ?? 'Item'}</div>
                        <Link to={`/items/${l.consignmentItemId}`} className="tg-mono ful__sku">{l.internalSku ?? l.consignmentItemId.slice(0, 8)}</Link>
                        {' '}<span className="tg-badge tg-badge--accent">{l.gradeCodeAtSale}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="tg-mono">{l.orderNumber ?? '—'}</div>
                    <div className="tg-muted ful__small">{l.buyerName ?? 'Buyer'} · {money(l.itemPriceMinor)}</div>
                  </td>
                  <td className="ful__small">
                    {l.courierCode ? (
                      <>
                        <div>{courierName(l.courierCode)}{l.trackingNumber ? <> · <span className="tg-mono">{l.trackingNumber}</span></> : <span className="tg-muted"> · no tracking yet</span>}</div>
                        <div className="tg-muted">
                          {l.courierCostMinor != null ? `Cost ${money(l.courierCostMinor)}` : 'Cost not recorded'}
                          {l.deliveredAt && ` · delivered ${dateOnly(l.deliveredAt)}`}
                        </div>
                      </>
                    ) : <span className="tg-muted">Not dispatched</span>}
                  </td>
                  <td className="ful__small tg-muted">{when(l) ? dateTime(when(l)) : '—'}</td>
                  <td className="ful__act">
                    <div className="ful__buttons">
                      <RowAction line={l} admin={admin} onOpen={setDialog} />
                      <button type="button" className="tg-button tg-button--subtle" aria-expanded={open === l.id}
                        onClick={() => setOpen(open === l.id ? null : l.id)}>
                        {open === l.id ? 'Hide history' : 'History'}
                      </button>
                    </div>
                  </td>
                </tr>
                {open === l.id && (
                  <tr className="ful__history">
                    <td colSpan={5}><LineHistory lineId={l.id} staff refreshKey={done} /></td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </QueueScreen>

      {dialog?.kind === 'dispatch' && <DispatchDialog line={dialog.line} onClose={() => setDialog(null)} onDone={finished} />}
      {dialog?.kind === 'deliver' && <DeliverDialog line={dialog.line} onClose={() => setDialog(null)} onDone={finished} />}
      {dialog?.kind === 'tracking' && <TrackingDialog line={dialog.line} onClose={() => setDialog(null)} onDone={finished} />}
      {dialog?.kind === 'close' && <CloseDialog line={dialog.line} onClose={() => setDialog(null)} onDone={finished} />}
    </>
  )
}

const when = (l: StaffOrderLine) => l.acceptedAt ?? l.deliveredAt ?? l.dispatchedAt ?? null
const stamp = (l: StaffOrderLine) => { const w = when(l); return w ? new Date(w).getTime() : 0 }

function RowAction({ line: l, admin, onOpen }: { line: StaffOrderLine; admin: boolean; onOpen: (d: Dialog) => void }) {
  if (l.state === 'open' || l.state === 'packing') {
    return <button type="button" className="tg-button tg-button--primary" onClick={() => onOpen({ kind: 'dispatch', line: l })}>Dispatch</button>
  }
  if (l.state === 'dispatched') {
    return (
      <>
        {!l.trackingNumber && <button type="button" className="tg-button" onClick={() => onOpen({ kind: 'tracking', line: l })}>Add tracking</button>}
        <button type="button" className="tg-button tg-button--primary" onClick={() => onOpen({ kind: 'deliver', line: l })}>Mark delivered</button>
      </>
    )
  }
  if (l.state === 'delivered') {
    const ended = !!l.acceptanceWindowEndsAt && new Date(l.acceptanceWindowEndsAt) <= new Date()
    return (
      <span className="ful__window">
        <span className="tg-muted ful__small">
          {ended ? 'Window ended — closes within a minute' : `Window closes ${dateTime(l.acceptanceWindowEndsAt)}`}
        </span>
        {/* TG-89: closing releases the seller's money, so only an admin may do it by hand. */}
        {admin && (
          <button type="button" className="tg-button" disabled={!ended} onClick={() => onOpen({ kind: 'close', line: l })}
            title={ended ? undefined : 'Available once the buyer’s window has ended'}>
            Close now
          </button>
        )}
      </span>
    )
  }
  return <span className="tg-badge tg-badge--good">{l.acceptedBy === 'return_declined' ? 'Closed · return declined' : 'Closed'}</span>
}

function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null)
    try { await fn(); onDone() } catch (e) { setError(e instanceof ApiError ? e.message : 'That did not work') } finally { setBusy(false) }
  }
  return { busy, error, setError, run }
}

function DispatchDialog({ line, onClose, onDone }: { line: StaffOrderLine; onClose: () => void; onDone: () => void }) {
  const [courier, setCourier] = useState('bluedart')
  const [other, setOther] = useState('')
  const [tracking, setTracking] = useState('')
  const [cost, setCost] = useState('')
  const [on, setOn] = useState(todayIST())
  const [notes, setNotes] = useState('')
  const s = useSubmit(onDone)
  const code = courier === 'other' ? other.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : courier
  const rupees = Number(cost)
  const valid = code.length >= 2 && cost.trim() !== '' && Number.isFinite(rupees) && rupees >= 0

  return (
    <ConfirmDialog
      open title={`Dispatch ${line.title?.split('·')[0].trim() ?? 'item'}`} confirmLabel="Dispatch" busy={s.busy}
      onCancel={onClose}
      onConfirm={() => {
        if (!valid) { s.setError('Choose the courier and enter what it cost.'); return }
        s.run(() => api.dispatchLine(line.id, {
          courierCode: code, trackingNumber: tracking.trim() || null, courierCostMinor: Math.round(rupees * 100),
          dispatchedOn: on, notes: notes.trim() || null,
        }))
      }}
    >
      <p className="tg-muted">Order {line.orderNumber} · to {line.buyerName ?? 'the buyer'}. The buyer is told the courier and tracking number; the cost and note stay with staff.</p>
      <div className="ful__form">
        <label className="ful__field">
          <span>Courier</span>
          <select className="tg-select" value={courier} onChange={(e) => setCourier(e.target.value)}>
            {COURIER_CHOICES.map((c) => <option key={c} value={c}>{courierName(c)}</option>)}
            <option value="other">Other…</option>
          </select>
        </label>
        {courier === 'other' && (
          <label className="ful__field"><span>Courier name</span>
            <input className="tg-input" value={other} onChange={(e) => setOther(e.target.value)} placeholder="e.g. Professional Couriers" />
          </label>
        )}
        <label className="ful__field"><span>Tracking number <em className="tg-muted">(or add it later)</em></span>
          <input className="tg-input tg-mono" value={tracking} onChange={(e) => setTracking(e.target.value)} />
        </label>
        <label className="ful__field"><span>Courier cost (₹)</span>
          <input className="tg-input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 180" />
        </label>
        <label className="ful__field"><span>Handed over on</span>
          <input className="tg-input" type="date" value={on} max={todayIST()} onChange={(e) => setOn(e.target.value)} />
        </label>
        <label className="ful__field ful__field--wide"><span>Notes / remarks <em className="tg-muted">(staff only, optional)</em></span>
          <textarea className="tg-input" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Packaging, insurance, anything the next person should know" />
        </label>
      </div>
      {s.error && <p className="ops__error" role="alert">{s.error}</p>}
    </ConfirmDialog>
  )
}

function DeliverDialog({ line, onClose, onDone }: { line: StaffOrderLine; onClose: () => void; onDone: () => void }) {
  const [on, setOn] = useState(todayIST())
  const [remarks, setRemarks] = useState('')
  const s = useSubmit(onDone)
  const min = line.dispatchedAt ? new Date(line.dispatchedAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : undefined
  return (
    <ConfirmDialog
      open title="Mark delivered" confirmLabel="Mark delivered" busy={s.busy} onCancel={onClose}
      onConfirm={() => s.run(() => api.deliverLine(line.id, { deliveredOn: on, remarks: remarks.trim() || null }))}
    >
      <p className="tg-muted">
        {courierName(line.courierCode)}{line.trackingNumber ? ` ${line.trackingNumber}` : ''} · order {line.orderNumber}.
        The buyer’s return window starts now, whatever date you enter, so a late entry never costs them time.
      </p>
      <div className="ful__form">
        <label className="ful__field"><span>Delivered on</span>
          <input className="tg-input" type="date" value={on} min={min} max={todayIST()} onChange={(e) => setOn(e.target.value)} />
        </label>
        <label className="ful__field ful__field--wide"><span>Remarks <em className="tg-muted">(staff only)</em></span>
          <textarea className="tg-input" rows={2} maxLength={1000} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Who received it, proof of delivery, condition of the box" />
        </label>
      </div>
      {s.error && <p className="ops__error" role="alert">{s.error}</p>}
    </ConfirmDialog>
  )
}

function TrackingDialog({ line, onClose, onDone }: { line: StaffOrderLine; onClose: () => void; onDone: () => void }) {
  const [tracking, setTracking] = useState('')
  const s = useSubmit(onDone)
  return (
    <ConfirmDialog open title="Add the tracking number" confirmLabel="Save and tell the buyer" busy={s.busy} onCancel={onClose}
      onConfirm={() => s.run(() => api.updateTracking(line.id, tracking))}>
      <label className="ful__field"><span>{courierName(line.courierCode)} tracking number</span>
        <input className="tg-input tg-mono" value={tracking} onChange={(e) => setTracking(e.target.value)} autoFocus />
      </label>
      {s.error && <p className="ops__error" role="alert">{s.error}</p>}
    </ConfirmDialog>
  )
}

function CloseDialog({ line, onClose, onDone }: { line: StaffOrderLine; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const s = useSubmit(onDone)
  return (
    <ConfirmDialog open title="Close this sale now" confirmLabel="Close the sale" busy={s.busy} onCancel={onClose}
      onConfirm={() => s.run(() => api.acceptLine(line.id, true, reason))}>
      <p>The buyer’s window has ended. Closing now releases the seller’s payout for {money(line.itemPriceMinor)}, as the automatic close would within the minute.</p>
      <label className="ful__field"><span>Reason (kept in the history, staff only)</span>
        <input className="tg-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Buyer confirmed by phone" />
      </label>
      {s.error && <p className="ops__error" role="alert">{s.error}</p>}
    </ConfirmDialog>
  )
}
