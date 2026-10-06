import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  api, ApiError, dateOnly, isStaff, money, useApi, useSession,
  type ConsignmentItem, type ReviewRequest, type Submission, type Technician,
} from '@trueglaz/core'
import { StateBadge } from '../components/ui'
import { QueueScreen } from '../components/QueueScreen'
import './OpsPage.css'

type Queue = 'intake' | 'inbound' | 'inspect' | 'price' | 'wanted'

const REJECT_REASONS = [
  { code: 'too_vague', label: 'Too vague to act on' },
  { code: 'not_our_category', label: "Not something TrueGlaz deals in" },
  { code: 'unrealistic_budget', label: 'Budget far below what these sell for' },
  { code: 'duplicate_request', label: 'Already asked for by this buyer' },
  { code: 'contact_details', label: 'Contains contact details or an off-platform offer' },
  { code: 'inappropriate', label: 'Inappropriate wording' },
]

const INTAKE_REASONS = ['insufficient_detail', 'prohibited_item', 'price_unrealistic']

/**
 * The operations floor, organised by what is waiting rather than by entity.
 *
 * Four queues, one shape. It used to be a column of cards per queue, each laid
 * out differently from the next and from Inventory, so a staff member moving
 * between screens had to relearn where things were and could not tell how big a
 * queue was until they opened it. It now wears the same chrome as Inventory —
 * counted tabs, a search box, a table, pagination — from QueueScreen, so a
 * change to the shape reaches both.
 *
 * What stays different is the row, because a submission, an item and a buyer's
 * request have nothing in common but the frame around them.
 */
export function OpsPage() {
  const { session } = useSession()
  const [queue, setQueue] = useState<Queue>('intake')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 10

  // Intake and pricing are staff work. A technician asking for them gets a 403,
  // so they are not asked for: an error where a queue should be reads as the
  // page being broken, not as a role they do not hold.
  const staff = isStaff(session)
  const pending = useApi(() => (staff ? api.pendingSubmissions() : Promise.resolve([])), [staff])
  const received = useApi(() => api.itemQueue('RECEIVED'), [])
  const inInspection = useApi(() => api.itemQueue('IN_INSPECTION'), [])
  const graded = useApi(() => (staff ? api.itemQueue('GRADED') : Promise.resolve([])), [staff])
  const wanted = useApi(() => (staff ? api.requestQueue() : Promise.resolve([])), [staff])
  const people = useApi(() => (staff ? api.staffUsers('', 'pending_review') : Promise.resolve([])), [staff])
  const roster = useApi(() => api.technicians(), [])
  // Pre-approved and in transit are one queue: both are units the hub is
  // waiting on, and receiving is the same act either way.
  const preApproved = useApi(() => (staff ? api.itemQueue('PRE_APPROVED') : Promise.resolve([])), [staff])
  const inTransit = useApi(() => (staff ? api.itemQueue('IN_TRANSIT_INBOUND') : Promise.resolve([])), [staff])

  /** One row per submission, because a box is received whole, not item by item. */
  const inboundRows = useMemo(() => {
    const by = new Map<string, ConsignmentItem[]>()
    for (const i of [...(preApproved.data ?? []), ...(inTransit.data ?? [])]) {
      by.set(i.submissionId, [...(by.get(i.submissionId) ?? []), i])
    }
    return [...by.entries()].map(([id, items]) => ({ id, items }))
  }, [preApproved.data, inTransit.data])

  const inspectRows = useMemo(
    () => [...(received.data ?? []), ...(inInspection.data ?? [])],
    [received.data, inInspection.data],
  )

  // The session arrives after the first render, so the open queue is derived
  // rather than stored — a technician must never land on a tab that is not there.
  const allowed: Queue[] = staff ? ['intake', 'inbound', 'inspect', 'price', 'wanted'] : ['inspect']
  const active = allowed.includes(queue) ? queue : allowed[0]

  const tabs = [
    staff && { key: 'intake', label: 'Intake', count: pending.data?.length ?? 0 },
    staff && { key: 'inbound', label: 'Inbound', count: inboundRows.length },
    { key: 'inspect', label: 'Inspection', count: inspectRows.length },
    staff && { key: 'price', label: 'Pricing', count: graded.data?.length ?? 0 },
    staff && { key: 'wanted', label: 'Requests', count: wanted.data?.length ?? 0 },
  ].filter(Boolean) as Array<{ key: string; label: string; count: number }>

  const source = {
    intake: pending,
    inbound: { ...preApproved, data: inboundRows, error: preApproved.error ?? inTransit.error,
               loading: preApproved.loading || inTransit.loading,
               // Receiving a box empties this queue and fills the next one, so
               // the Inspection count has to be refreshed with it or the tab
               // row contradicts the table underneath it.
               reload: () => { preApproved.reload(); inTransit.reload(); received.reload() } },
    inspect: { ...received, data: inspectRows, error: received.error ?? inInspection.error,
               loading: received.loading || inInspection.loading,
               reload: () => { received.reload(); inInspection.reload() } },
    price: graded,
    wanted,
  }[active]

  const rows: any[] = (source.data as any[]) ?? []

  // One predicate per queue: the thing a person would actually type.
  const matches = (r: any) => {
    const t = search.trim().toLowerCase()
    if (!t) return true
    const hay = active === 'intake' ? [r.id, r.pricingMode]
      : active === 'inbound' ? [r.id, ...r.items.map((i: ConsignmentItem) => i.internalSku)]
      : active === 'wanted' ? [r.wanted, r.note, r.minGradeCode]
        : [r.internalSku, r.serialNumber, r.declaredGradeCode, r.assignedGradeCode]
    return hay.some((v: string | null) => v?.toLowerCase().includes(t))
  }
  const filtered = rows.filter(matches)
  const pages = Math.ceil(filtered.length / perPage)
  const validPage = Math.min(Math.max(1, page), pages || 1)
  const shown = filtered.slice((validPage - 1) * perPage, validPage * perPage)

  const go = (next: string) => { setQueue(next as Queue); setPage(1); setSearch('') }
  const onSearch = (v: string) => { setSearch(v); setPage(1) }

  const unit = active === 'intake' || active === 'inbound' ? 'submissions'
    : active === 'wanted' ? 'requests' : 'items'
  const placeholder = active === 'intake' ? 'Search by submission id…'
    : active === 'inbound' ? 'Search by submission or SKU…'
    : active === 'wanted' ? 'Search what buyers asked for…'
      : 'Search by SKU, serial or grade…'
  const empty = {
    intake: 'Nothing waiting on pre-approval',
    inbound: 'Nothing on its way in',
    inspect: 'Nothing to inspect',
    price: 'Nothing waiting on a price',
    wanted: 'Nothing waiting',
  }[active]

  return (
    <>
      <QueueScreen
        title="Operations"
        subtitle="What is waiting, and what to do about it"
        tabs={tabs}
        active={active}
        onTab={go}
        search={search}
        onSearch={onSearch}
        searchPlaceholder={placeholder}
        shown={filtered.length}
        total={rows.length}
        unit={unit}
        loading={source.loading}
        error={source.error}
        onRetry={source.reload}
        emptyTitle={empty}
        page={validPage}
        pages={pages}
        onPage={setPage}
      >
        {active === 'intake' && <IntakeTable rows={shown} reload={pending.reload} />}
        {active === 'inbound' && <InboundTable rows={shown} reload={source.reload} />}
        {active === 'inspect' && (
          <InspectTable rows={shown} roster={roster.data ?? []} reload={source.reload} />
        )}
        {active === 'price' && <PricingTable rows={shown} reload={graded.reload} />}
        {active === 'wanted' && <RequestTable rows={shown} reload={wanted.reload} />}
      </QueueScreen>

      {/* Not a queue of items, so not a tab — but it is staff work waiting, and
          a staff member looking for their work should not have to find it
          somewhere else on the page. */}
      {staff && (
        <p className="ops__aside">
          <Link to="/people">
            People waiting on a selling decision
            <span className="ops__aside-count">{people.data?.length ?? 0}</span>
          </Link>
        </p>
      )}
    </>
  )
}

/** Shared by every table here: run one action, show what went wrong, reload. */
function useAction(reload: () => void) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id); setError(null)
    try { await fn(); reload() } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(null) }
  }
  return { busy, error, act }
}

function ErrorRow({ error, span }: { error: string | null; span: number }) {
  if (!error) return null
  return (
    <tr><td colSpan={span}><p className="ops__error" role="alert">{error}</p></td></tr>
  )
}

/** Pre-approve, issue the label, or turn it away with a reason the seller sees. */
function IntakeTable({ rows, reload }: { rows: Submission[]; reload: () => void }) {
  const { busy, error, act } = useAction(reload)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  return (
    <table className="q__table">
      <thead>
        <tr>
          <th>Submission</th>
          <th>Pricing</th>
          <th>Submitted</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <ErrorRow error={error} span={4} />
        {rows.map((s) => (
          <tr key={s.id}>
            <td>
              <span className="ops__id tg-mono">{s.id.slice(0, 8)}</span>
              <SubmissionItems submissionId={s.id} />
            </td>
            <td><span className="tg-badge">{s.pricingMode}</span></td>
            <td className="tg-muted">{s.submittedAt ? dateOnly(s.submittedAt) : '—'}</td>
            <td>
              {rejecting === s.id ? (
                <span className="ops__inline">
                  <select
                    className="tg-select ops__reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-label="Reason for turning it away"
                  >
                    <option value="">Pick a reason…</option>
                    {INTAKE_REASONS.map((r) => (
                      <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <button
                    className="tg-button"
                    disabled={!reason || busy === s.id}
                    onClick={() => act(s.id, () => api.rejectSubmission(s.id, reason))}
                  >
                    Confirm
                  </button>
                  <button className="tg-button" onClick={() => { setRejecting(null); setReason('') }}>
                    Cancel
                  </button>
                </span>
              ) : (
                <span className="ops__inline">
                  <button
                    className="tg-button tg-button--primary"
                    disabled={busy === s.id}
                    onClick={() => act(s.id, () => api.preApprove(s.id, 'bluedart'))}
                  >
                    {busy === s.id ? 'Working…' : 'Pre-approve and label'}
                  </button>
                  <button className="tg-button" disabled={busy === s.id} onClick={() => setRejecting(s.id)}>
                    Reject
                  </button>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SubmissionItems({ submissionId }: { submissionId: string }) {
  const view = useApi(() => api.submission(submissionId), [submissionId])
  if (!view.data) return null
  return (
    <span className="ops__gear">
      {view.data.items.map((i) => i.internalSku).join(', ')}
      {' · '}
      {money(view.data.items.reduce((t, i) => t + i.askingAmountMinor, 0))} asked
    </span>
  )
}

/**
 * Boxes the hub is waiting on, and the act of taking one in.
 *
 * Receiving is the one step with no other home: the state machine's
 * IN_TRANSIT_INBOUND → RECEIVED move routes here precisely because the raw
 * transition would skip the intake record and the bin assignment.
 */
function InboundTable({
  rows, reload,
}: { rows: Array<{ id: string; items: ConsignmentItem[] }>; reload: () => void }) {
  const { busy, error, act } = useAction(reload)
  const bins = useApi(() => api.storageBins(), [])
  const bin = bins.data?.[0]

  async function receive(submissionId: string) {
    const shipments = await api.submissionShipments(submissionId)
    const shipment = shipments[0]
    if (!shipment) throw new Error('No inbound shipment for this submission')
    // A courier that never scanned still arrives at the counter; the state
    // machine wants the leg recorded before the box can be taken in.
    if (shipment.state === 'label_issued') await api.markInTransit(shipment.id)
    await api.receive(shipment.id, { outcomes: {}, binCode: bin?.code ?? null })
  }

  return (
    <table className="q__table">
      <thead>
        <tr>
          <th>Submission</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <ErrorRow error={error} span={3} />
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <span className="ops__id tg-mono">{r.id.slice(0, 8)}</span>
              <span className="ops__gear">
                {r.items.map((i) => i.internalSku).join(', ')}
                {' · '}{r.items.length} item{r.items.length === 1 ? '' : 's'}
              </span>
            </td>
            <td><StateBadge state={r.items[0].currentState} /></td>
            <td>
              <span className="ops__inline">
                <button
                  className="tg-button tg-button--primary"
                  disabled={busy === r.id}
                  onClick={() => act(r.id, () => receive(r.id))}
                >
                  {busy === r.id ? 'Receiving…' : `Receive into ${bin?.code ?? 'a bin'}`}
                </button>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Received and in progress in one list, because it is one bench. */
function InspectTable({
  rows, roster, reload,
}: { rows: ConsignmentItem[]; roster: Technician[]; reload: () => void }) {
  const { busy, error, act } = useAction(reload)
  const bench = (id?: string | null) => roster.find((t) => t.id === id)?.displayName ?? null

  return (
    <table className="q__table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Declared</th>
          <th>On the bench of</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <ErrorRow error={error} span={5} />
        {rows.map((i) => (
          <tr key={i.id}>
            <td><Link to={`/items/${i.id}`} className="ops__id tg-mono">{i.internalSku}</Link></td>
            <td>{i.declaredGradeCode}</td>
            <td>
              {bench(i.assignedTechnicianUserId)
                ?? <span className="tg-muted">unassigned</span>}
            </td>
            <td><StateBadge state={i.currentState} /></td>
            <td>
              <span className="ops__inline">
                {i.currentState === 'IN_INSPECTION' ? (
                  <Link className="tg-button tg-button--primary" to={`/ops/inspect/${i.id}`}>Continue →</Link>
                ) : (
                  <button
                    className="tg-button tg-button--primary"
                    disabled={busy === i.id}
                    onClick={() => act(i.id, () => api.startInspection(i.id))}
                  >
                    {busy === i.id ? 'Starting…' : 'Start inspection'}
                  </button>
                )}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Graded items waiting on a price. */
function PricingTable({ rows, reload }: { rows: ConsignmentItem[]; reload: () => void }) {
  const { busy, error, act } = useAction(reload)
  const [override, setOverride] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)

  const price = (id: string, amount?: number) =>
    act(id, () => api.propose(id, {
      staffAmountMinor: amount ?? null,
      staffOverrideReason: amount ? 'Priced off comparable recent sales' : null,
    }))

  return (
    <table className="q__table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Grade</th>
          <th className="q__num">Asking</th>
          <th className="q__num">Floor</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <ErrorRow error={error} span={5} />
        {rows.map((i) => (
          <tr key={i.id}>
            <td>
              <Link to={`/items/${i.id}`} className="ops__id tg-mono">{i.internalSku}</Link>
              {/* Pricing takes the fee snapshot: it is what the payout will read,
                  whatever the fee table says later. */}
              <span className="ops__gear">declared {i.declaredGradeCode} · takes the fee snapshot</span>
            </td>
            <td><span className="tg-badge tg-badge--accent">{i.assignedGradeCode}</span></td>
            <td className="q__num">{money(i.askingAmountMinor)}</td>
            <td className="q__num">{i.floorAmountMinor != null ? money(i.floorAmountMinor) : '—'}</td>
            <td>
              {open === i.id ? (
                <span className="ops__inline">
                  <input
                    className="tg-input ops__amount"
                    type="number"
                    min={1}
                    placeholder="Override (₹)"
                    aria-label="Price it by hand"
                    value={override[i.id] ?? ''}
                    onChange={(e) => setOverride({ ...override, [i.id]: e.target.value })}
                  />
                  <button
                    className="tg-button tg-button--primary"
                    disabled={busy === i.id || !Number(override[i.id])}
                    onClick={() => price(i.id, Math.round(Number(override[i.id]) * 100))}
                  >
                    Set
                  </button>
                  <button className="tg-button" onClick={() => setOpen(null)}>Cancel</button>
                </span>
              ) : (
                <span className="ops__inline">
                  <button
                    className="tg-button tg-button--primary"
                    disabled={busy === i.id}
                    onClick={() => price(i.id)}
                  >
                    {busy === i.id ? 'Pricing…' : 'Use the guided price'}
                  </button>
                  <button className="tg-button" disabled={busy === i.id} onClick={() => setOpen(i.id)}>
                    By hand
                  </button>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * What buyers have asked for, waiting to go on the public board.
 *
 * This is the only place on the site where a member of the public writes words
 * that other people will read, so nothing reaches the board unread — an
 * unmoderated noticeboard on a marketplace becomes a channel for off-platform
 * deals within a week.
 */
function RequestTable({ rows, reload }: { rows: ReviewRequest[]; reload: () => void }) {
  const { busy, error, act } = useAction(reload)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  return (
    <table className="q__table">
      <thead>
        <tr>
          <th>Wanted</th>
          <th className="q__num">Up to</th>
          <th>Asked</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <ErrorRow error={error} span={4} />
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <span className="ops__wanted">{r.wanted}</span>
              {r.fromCatalogue && <span className="tg-badge tg-badge--accent">from the catalogue</span>}
              {r.note && <span className="ops__gear">“{r.note}”</span>}
            </td>
            <td className="q__num">
              {r.maxPriceMinor != null ? money(r.maxPriceMinor) : '—'}
              {r.minGradeCode && <span className="ops__gear">{r.minGradeCode} or better</span>}
            </td>
            <td className="tg-muted">{r.createdAt ? dateOnly(r.createdAt) : '—'}</td>
            <td>
              {rejecting === r.id ? (
                <span className="ops__inline">
                  <select
                    className="tg-select ops__reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-label="Reason for turning it down"
                  >
                    <option value="">Pick a reason…</option>
                    {REJECT_REASONS.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
                  </select>
                  <button
                    className="tg-button"
                    disabled={!reason || busy === r.id}
                    onClick={() => act(r.id, () => api.rejectRequest(r.id, reason))}
                  >
                    Confirm
                  </button>
                  <button className="tg-button" onClick={() => { setRejecting(null); setReason('') }}>
                    Cancel
                  </button>
                </span>
              ) : (
                <span className="ops__inline">
                  <button
                    className="tg-button tg-button--primary"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, () => api.publishRequest(r.id))}
                  >
                    Put on the board
                  </button>
                  <button className="tg-button" disabled={busy === r.id} onClick={() => setRejecting(r.id)}>
                    Turn down
                  </button>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
