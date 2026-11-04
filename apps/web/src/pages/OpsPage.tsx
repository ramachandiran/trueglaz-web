import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  api, ApiError, dateOnly, dateTime, isStaff, money, relative, useApi, useSession,
  type ConsignmentItem, type InboundClock, type ManagedListing, type ReviewRequest, type Submission, type Technician,
} from '@trueglaz/core'
import { StateBadge } from '../components/ui'
import { QueueScreen } from '../components/QueueScreen'
import { ModelPhoto } from '../components/ModelPhoto'
import './OpsPage.css'

type Queue = 'intake' | 'inbound' | 'inspect' | 'price' | 'listed' | 'wanted'

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
  // ?tab= lets the control room open the exact queue a piece of work sits in.
  const [params] = useSearchParams()
  const [queue, setQueue] = useState<Queue>(() => (params.get('tab') as Queue | null) ?? 'intake')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 10

  // Intake and pricing are staff work. A technician asking for them gets a 403,
  // so they are not asked for: an error where a queue should be reads as the
  // page being broken, not as a role they do not hold.
  const staff = isStaff(session)
  const pending = useApi(() => (staff ? api.pendingSubmissions() : Promise.resolve([])), [staff])
  const received = useApi(() => api.itemQueue('RECEIVED'), [])
  const awaitingInspection = useApi(() => api.itemQueue('AWAITING_INSPECTION'), [])
  const inInspection = useApi(() => api.itemQueue('IN_INSPECTION'), [])
  const graded = useApi(() => (staff ? api.itemQueue('GRADED') : Promise.resolve([])), [staff])
  const wanted = useApi(() => (staff ? api.requestQueue() : Promise.resolve([])), [staff])
  const people = useApi(() => (staff ? api.staffUsers('', 'pending_review') : Promise.resolve([])), [staff])
  const roster = useApi(() => api.technicians(), [])
  // Pre-approved and in transit are one queue: both are units the hub is
  // waiting on, and receiving is the same act either way.
  const preApproved = useApi(() => (staff ? api.itemQueue('PRE_APPROVED') : Promise.resolve([])), [staff])
  const inTransit = useApi(() => (staff ? api.itemQueue('IN_TRANSIT_INBOUND') : Promise.resolve([])), [staff])
  // The ship-by clock for each box. Kept out of the queue's own error: an API
  // without it should still show and receive boxes, just without the dates.
  const shipClock = useApi(() => (staff ? api.inboundClock() : Promise.resolve([] as InboundClock[])), [staff])
  const clock = useMemo(
    () => new Map((shipClock.data ?? []).map((c) => [c.submissionId, c] as const)),
    [shipClock.data],
  )
  // Live listings, so staff can reprice one without leaving Operations.
  const listed = useApi(() => (staff ? api.managedListings() : Promise.resolve([])), [staff])
  // The catalogue, to turn an item's productModelId into a readable model name.
  const models = useApi(() => api.models(), [])
  const names = useMemo(
    () => new Map((models.data?.content ?? []).map((m) => [m.id, m.name] as const)),
    [models.data],
  )

  /** One row per submission, because a box is received whole, not item by item. */
  const inboundRows = useMemo(() => {
    const by = new Map<string, ConsignmentItem[]>()
    for (const i of [...(preApproved.data ?? []), ...(inTransit.data ?? [])]) {
      by.set(i.submissionId, [...(by.get(i.submissionId) ?? []), i])
    }
    return [...by.entries()].map(([id, items]) => ({ id, items }))
  }, [preApproved.data, inTransit.data])

  const inspectRows = useMemo(
    () => [...(received.data ?? []), ...(awaitingInspection.data ?? []), ...(inInspection.data ?? [])],
    [received.data, awaitingInspection.data, inInspection.data],
  )

  // The session arrives after the first render, so the open queue is derived
  // rather than stored — a technician must never land on a tab that is not there.
  const allowed: Queue[] = staff ? ['intake', 'inbound', 'inspect', 'price', 'listed', 'wanted'] : ['inspect']
  const active = allowed.includes(queue) ? queue : allowed[0]

  const tabs = [
    staff && { key: 'intake', label: 'Intake', count: pending.data?.length ?? 0 },
    staff && { key: 'inbound', label: 'Inbound', count: inboundRows.length },
    { key: 'inspect', label: 'Inspection', count: inspectRows.length },
    staff && { key: 'price', label: 'Pricing', count: graded.data?.length ?? 0 },
    staff && { key: 'listed', label: 'Listed', count: listed.data?.length ?? 0 },
    staff && { key: 'wanted', label: 'Requests', count: wanted.data?.length ?? 0 },
  ].filter(Boolean) as Array<{ key: string; label: string; count: number }>

  const source = {
    intake: pending,
    inbound: { ...preApproved, data: inboundRows, error: preApproved.error ?? inTransit.error,
               loading: preApproved.loading || inTransit.loading,
               // Receiving a box empties this queue and fills the next one, so
               // the Inspection count has to be refreshed with it or the tab
               // row contradicts the table underneath it.
               reload: () => { preApproved.reload(); inTransit.reload(); received.reload(); shipClock.reload() } },
    inspect: { ...received, data: inspectRows, error: received.error ?? awaitingInspection.error ?? inInspection.error,
               loading: received.loading || awaitingInspection.loading || inInspection.loading,
               reload: () => { received.reload(); awaitingInspection.reload(); inInspection.reload() } },
    price: graded,
    listed,
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
      : active === 'listed' ? [r.internalSku, r.title, r.brandName, r.modelName, r.gradeCode, r.sellerName]
        : [r.internalSku, r.serialNumber, r.declaredGradeCode, r.assignedGradeCode]
    return hay.some((v: string | null) => v?.toLowerCase().includes(t))
  }
  const filtered = rows.filter(matches)

  // Most recently touched first, so the latest activity is at the top of every
  // queue — except Inbound, where the box most past its ship-by date leads,
  // because that is the one somebody has to chase today.
  const timeOf = (r: any): number => {
    const v = lastUpdated(active, r, clock)
    return v ? new Date(v).getTime() : 0
  }
  // Only a box still at the seller's is late in a way anyone can act on; one a
  // courier has picked up is coming regardless, so it sorts by time as usual.
  const lateness = (r: any): number =>
    active === 'inbound' && r.items.every((i: ConsignmentItem) => i.currentState === 'PRE_APPROVED')
      ? clock.get(r.id)?.daysOverdue ?? 0
      : 0
  const sorted = [...filtered].sort((a, b) => lateness(b) - lateness(a) || timeOf(b) - timeOf(a))

  const pages = Math.ceil(sorted.length / perPage)
  const validPage = Math.min(Math.max(1, page), pages || 1)
  const shown = sorted.slice((validPage - 1) * perPage, validPage * perPage)

  const go = (next: string) => { setQueue(next as Queue); setPage(1); setSearch('') }
  const onSearch = (v: string) => { setSearch(v); setPage(1) }

  const unit = active === 'intake' || active === 'inbound' ? 'submissions'
    : active === 'wanted' ? 'requests' : active === 'listed' ? 'listings' : 'items'
  const placeholder = active === 'intake' ? 'Search by submission id…'
    : active === 'inbound' ? 'Search by submission or SKU…'
    : active === 'wanted' ? 'Search what buyers asked for…'
    : active === 'listed' ? 'Search by item, SKU, grade or seller…'
      : 'Search by SKU, serial or grade…'
  const empty = {
    intake: 'Nothing waiting on pre-approval',
    inbound: 'Nothing on its way in',
    inspect: 'Nothing to inspect',
    price: 'Nothing waiting on a price',
    listed: 'Nothing is on sale right now',
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
        {active === 'intake' && <IntakeTable rows={shown} names={names} reload={pending.reload} />}
        {active === 'inbound' && <InboundTable rows={shown} names={names} clock={clock} reload={source.reload} />}
        {active === 'inspect' && (
          <InspectTable rows={shown} names={names} roster={roster.data ?? []} reload={source.reload} />
        )}
        {active === 'price' && <PricingTable rows={shown} names={names} reload={graded.reload} />}
        {active === 'listed' && <ListedTable rows={shown} reload={listed.reload} />}
        {active === 'wanted' && <RequestTable rows={shown} reload={wanted.reload} />}
      </QueueScreen>

      {/* Not a queue of items, so not a tab — but it is staff work waiting, and
          a staff member looking for their work should not have to find it
          somewhere else on the page. */}
      {staff && (
        <p className="ops__aside">
          <Link to="/admin/people">
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

/**
 * The best human name for an item: its catalogue model, else what the seller
 * typed, else null — the caller then uses the SKU as the title.
 */
function itemTitle(i: { productModelId: string | null; modelFreeText: string | null }, names: Map<string, string>): string | null {
  return (i.productModelId ? names.get(i.productModelId) ?? null : null) || i.modelFreeText || null
}

/**
 * The leading cell every item queue shares: the model as the row title, the SKU
 * as a muted second line. The SKU only appears there when there is a real name
 * above it — otherwise it is the title, and printing it twice was the bug this
 * replaces.
 */
function ItemCell({ item, names, meta }: { item: ConsignmentItem; names: Map<string, string>; meta?: ReactNode }) {
  const name = itemTitle(item, names)
  return (
    <td>
      <span className="ops__pic"><ModelPhoto modelId={item.productModelId} kind="gear" size="mini" alt="" badge={false} /></span>
      <span className="ops__model">{name ?? item.internalSku}</span>
      {(name || meta) && (
        <span className="ops__gear">
          {name && <span className="tg-mono">{item.internalSku}</span>}
          {name && meta ? ' · ' : null}
          {meta}
        </span>
      )}
    </td>
  )
}

function ErrorRow({ error, span }: { error: string | null; span: number }) {
  if (!error) return null
  return (
    <tr><td colSpan={span}><p className="ops__error" role="alert">{error}</p></td></tr>
  )
}

/** The newest of several timestamps, ignoring the missing ones. */
function latest(...at: Array<string | null | undefined>): string | null {
  return at.reduce<string | null>((m, v) => (v && (!m || new Date(v) > new Date(m)) ? v : m), null)
}

/**
 * When a row last changed, one rule per queue. Submissions and requests fall
 * back to when they were made if the API predates their updatedAt; an inbound
 * box is the newest of its items and its own ship-by changes.
 */
function lastUpdated(queue: Queue, r: any, clock: Map<string, InboundClock>): string | null {
  switch (queue) {
    case 'intake': return latest(r.updatedAt, r.submittedAt, r.createdAt)
    case 'inbound': return latest(clock.get(r.id)?.updatedAt, ...r.items.map((i: ConsignmentItem) => i.updatedAt))
    case 'listed': return latest(r.updatedAt, r.listedAt)
    case 'wanted': return latest(r.updatedAt, r.createdAt)
    default: return r.updatedAt ?? null
  }
}

/**
 * The ship-by date, and how it stands: due in a few days, late by some, or
 * already posted. A late box also says when it lapses on its own, so nobody
 * chases a seller the sweep is about to void anyway.
 */
function ShipByCell({ clock, unposted }: { clock?: InboundClock; unposted: boolean }) {
  if (!clock?.shipBy) return <td className="tg-muted">—</td>
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(`${clock.shipBy}T00:00:00`)
  const daysLeft = Math.round((due.getTime() - today.getTime()) / 86400000)
  return (
    <td>
      <span>{dateOnly(clock.shipBy)}</span>
      {!unposted ? (
        <span className="ops__gear">Posted</span>
      ) : clock.daysOverdue > 0 ? (
        <>
          <span className="tg-badge tg-badge--bad ops__late">{clock.daysOverdue} day{clock.daysOverdue === 1 ? '' : 's'} late</span>
          {clock.lapsesOn && <span className="ops__gear">Lapses {dateOnly(clock.lapsesOn)}</span>}
        </>
      ) : (
        <span className="ops__gear">{daysLeft === 0 ? 'Due today' : `Due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}</span>
      )}
    </td>
  )
}

/** "3 hours ago", with the exact time underneath and on hover. */
function UpdatedCell({ at }: { at: string | null }) {
  if (!at) return <td className="tg-muted">—</td>
  return (
    <td className="ops__updated">
      <time dateTime={at} title={dateTime(at)}>{relative(at)}</time>
      <span className="ops__gear">{dateTime(at)}</span>
    </td>
  )
}

/** Pre-approve, issue the label, or turn it away with a reason the seller sees. */
function IntakeTable({ rows, names, reload }: { rows: Submission[]; names: Map<string, string>; reload: () => void }) {
  return (
    <table className="q__table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Pricing</th>
          <th>Submitted</th>
          <th>Last updated</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => <IntakeRow key={s.id} s={s} names={names} reload={reload} />)}
      </tbody>
    </table>
  )
}

/** One submission row: the model leads, and the whole row opens the item. */
function IntakeRow({ s, names, reload }: { s: Submission; names: Map<string, string>; reload: () => void }) {
  const navigate = useNavigate()
  const { busy, error, act } = useAction(reload)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const view = useApi(() => api.submission(s.id), [s.id])

  const items = view.data?.items ?? []
  const first = items[0]
  const name = first ? itemTitle(first, names) : null
  const title = first ? (name ?? first.internalSku) : 'Loading…'
  const open = () => { if (first) navigate(`/items/${first.id}`) }

  return (
    <>
      <tr className={first ? 'q__row--click' : undefined} onClick={open}>
        <td>
          <span className="ops__model">{title}{items.length > 1 ? ` +${items.length - 1} more` : ''}</span>
          {first && (
            <span className="ops__gear">
              {name && <span className="tg-mono">{items.map((i) => i.internalSku).join(', ')} · </span>}
              {money(items.reduce((t, i) => t + i.askingAmountMinor, 0))} asked
            </span>
          )}
        </td>
        <td><span className="tg-badge">{s.pricingMode}</span></td>
        <td className="tg-muted">{s.submittedAt ? dateOnly(s.submittedAt) : '—'}</td>
        <UpdatedCell at={latest(s.updatedAt, s.submittedAt, s.createdAt)} />
        <td onClick={(e) => e.stopPropagation()}>
          {rejecting ? (
            <span className="ops__inline ops__reject">
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
              <textarea
                className="tg-input ops__reject-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note for the seller — what exactly was wrong? (optional)"
                rows={2}
                maxLength={1000}
                aria-label="Note to the seller"
              />
              <span className="ops__inline">
                <button
                  className="tg-button"
                  disabled={!reason || busy === s.id}
                  onClick={() => act(s.id, () => api.rejectSubmission(s.id, reason, note.trim() || undefined))}
                >
                  Confirm
                </button>
                <button className="tg-button" onClick={() => { setRejecting(false); setReason(''); setNote('') }}>
                  Cancel
                </button>
              </span>
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
              <button className="tg-button" disabled={busy === s.id} onClick={() => setRejecting(true)}>
                Reject
              </button>
            </span>
          )}
        </td>
      </tr>
      {error && <tr><td colSpan={5}><p className="ops__error" role="alert">{error}</p></td></tr>}
    </>
  )
}

/**
 * What pre-approval produced, shown where the box now waits.
 *
 * Pre-approve issues an inbound label and a tracking number, but nothing in the
 * queue said so — the row simply moved here, which read as "nothing happened".
 * This is the proof it did: the courier and the tracking number the seller is
 * shipping under.
 */
function InboundInfo({ submissionId }: { submissionId: string }) {
  const ships = useApi(() => api.submissionShipments(submissionId), [submissionId])
  const s = ships.data?.[0]
  if (!s) return null
  return (
    <span className="ops__gear">
      Label issued · {s.courierCode}{s.trackingNumber ? ` · ${s.trackingNumber}` : ''}
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
  rows, names, clock, reload,
}: {
  rows: Array<{ id: string; items: ConsignmentItem[] }>
  names: Map<string, string>
  clock: Map<string, InboundClock>
  reload: () => void
}) {
  const navigate = useNavigate()
  const { busy, error, act } = useAction(reload)
  // Lapsing voids the seller's label, so it takes a second, deliberate click.
  const [confirming, setConfirming] = useState<string | null>(null)
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
          <th>Item</th>
          <th>Ship by</th>
          <th>Status</th>
          <th>Last updated</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <ErrorRow error={error} span={5} />
        {rows.map((r) => {
          const first = r.items[0]
          const name = itemTitle(first, names)
          const title = name ?? first.internalSku
          const c = clock.get(r.id)
          // Still at the seller's: nothing scanned, so the clock applies and
          // the box can be given more time or lapsed. Once a courier has it,
          // it is on its way however late, and only receiving makes sense.
          const unposted = r.items.every((i) => i.currentState === 'PRE_APPROVED')
          return (
            <tr key={r.id} className="q__row--click" onClick={() => navigate(`/items/${first.id}`)}>
              <td>
                <span className="ops__pic"><ModelPhoto modelId={first.productModelId} kind="gear" size="mini" alt="" badge={false} /></span>
                <span className="ops__model">{title}{r.items.length > 1 ? ` +${r.items.length - 1} more` : ''}</span>
                <span className="ops__gear">
                  {name && <span className="tg-mono">{r.items.map((i) => i.internalSku).join(', ')} · </span>}
                  {r.items.length} item{r.items.length === 1 ? '' : 's'}
                </span>
                <InboundInfo submissionId={r.id} />
              </td>
              <ShipByCell clock={c} unposted={unposted} />
              <td><StateBadge state={first.currentState} /></td>
              <UpdatedCell at={latest(c?.updatedAt, ...r.items.map((i) => i.updatedAt))} />
              <td onClick={(e) => e.stopPropagation()}>
                {confirming === r.id ? (
                  <span className="ops__inline ops__confirm">
                    <span>Void the label? The seller is told and can submit again.</span>
                    <button
                      className="tg-button ops__danger"
                      disabled={busy === r.id}
                      onClick={() => act(r.id, async () => { await api.lapseSubmission(r.id); setConfirming(null) })}
                    >
                      {busy === r.id ? 'Lapsing…' : 'Yes, lapse it'}
                    </button>
                    <button className="tg-button" onClick={() => setConfirming(null)}>Keep it</button>
                  </span>
                ) : (
                  <span className="ops__inline">
                    <button
                      className="tg-button tg-button--primary"
                      disabled={busy === r.id}
                      onClick={() => act(r.id, () => receive(r.id))}
                    >
                      {busy === r.id ? 'Working…' : `Receive into ${bin?.code ?? 'a bin'}`}
                    </button>
                    {unposted && c && (
                      <>
                        <button
                          className="tg-button"
                          disabled={busy === r.id}
                          title="Move the ship-by date on a week and tell the seller"
                          onClick={() => act(r.id, () => api.extendShipBy(r.id, 7))}
                        >
                          Extend 7 days
                        </button>
                        <button className="tg-button" disabled={busy === r.id} onClick={() => setConfirming(r.id)}>
                          Lapse now
                        </button>
                      </>
                    )}
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Staff picks who inspects a received unit; the technician then starts it. */
function AssignSelect({ item, roster, reload }: { item: ConsignmentItem; roster: Technician[]; reload: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function set(id: string) {
    setBusy(true); setError(null)
    try { await api.assignTechnician(item.id, id || null); reload() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not assign that') }
    finally { setBusy(false) }
  }
  return (
    <>
      <select
        className="tg-select"
        aria-label="Assign a technician"
        value={item.assignedTechnicianUserId ?? ''}
        disabled={busy}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">Assign a technician…</option>
        {roster.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
      </select>
      {error && <p className="ops__error" role="alert">{error}</p>}
    </>
  )
}

/** Received and in progress in one list, because it is one bench. */
function InspectTable({
  rows, names, roster, reload,
}: { rows: ConsignmentItem[]; names: Map<string, string>; roster: Technician[]; reload: () => void }) {
  const navigate = useNavigate()
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
          <th>Last updated</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <ErrorRow error={error} span={6} />
        {rows.map((i) => (
          <tr key={i.id} className="q__row--click" onClick={() => navigate(`/items/${i.id}`)}>
            <ItemCell item={i} names={names} />
            <td>{i.declaredGradeCode}</td>
            <td onClick={(e) => e.stopPropagation()}>
              {i.currentState === 'RECEIVED'
                ? <AssignSelect item={i} roster={roster} reload={reload} />
                : (bench(i.assignedTechnicianUserId) ?? <span className="tg-muted">unassigned</span>)}
            </td>
            <td><StateBadge state={i.currentState} /></td>
            <UpdatedCell at={i.updatedAt} />
            <td onClick={(e) => e.stopPropagation()}>
              <span className="ops__inline">
                {i.currentState === 'IN_INSPECTION' ? (
                  // Already on the bench — the technician resumes their report.
                  <Link className="tg-button tg-button--primary" to={`/admin/operations/inspect/${i.id}`}>Continue →</Link>
                ) : i.currentState === 'AWAITING_INSPECTION' ? (
                  // Queued — the technician starts the checklist (not staff).
                  <button
                    className="tg-button tg-button--primary"
                    disabled={busy === i.id}
                    onClick={() => act(i.id, () => api.startInspection(i.id))}
                  >
                    {busy === i.id ? 'Starting…' : 'Start inspection'}
                  </button>
                ) : (
                  // RECEIVED — staff send it to inspection once a technician is picked.
                  <button
                    className="tg-button tg-button--primary"
                    disabled={busy === i.id || !i.assignedTechnicianUserId}
                    title={i.assignedTechnicianUserId ? undefined : 'Assign a technician first'}
                    onClick={() => act(i.id, () => api.sendToInspection(i.id, i.assignedTechnicianUserId!))}
                  >
                    {busy === i.id ? 'Sending…' : 'Send to inspection'}
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
function PricingTable({ rows, names, reload }: { rows: ConsignmentItem[]; names: Map<string, string>; reload: () => void }) {
  const navigate = useNavigate()
  const { busy, error, act } = useAction(reload)
  const [override, setOverride] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)

  const price = (id: string, amount?: number) =>
    act(id, () => api.propose(id, {
      staffAmountMinor: amount ?? null,
      staffOverrideReason: amount ? 'Priced off comparable recent sales' : null,
    }))

  /**
   * The guided price needs a reference price for this model and grade, and most
   * of the catalogue has none — a widened model list outran the reference data.
   * When that is why it fails, this is not a dead end: open the by-hand field
   * right here with a message, rather than leaving a staff member staring at a
   * refusal with nowhere to go.
   */
  const priceGuided = (id: string) =>
    act(id, async () => {
      try {
        await api.propose(id, {})
      } catch (e) {
        if (e instanceof ApiError && /guided price/i.test(e.message)) {
          setOpen(id)
          throw new Error('No guided price for this model and grade yet — set one by hand below.')
        }
        throw e
      }
    })

  return (
    <table className="q__table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Grade</th>
          <th className="q__num">Asking</th>
          <th className="q__num">Floor</th>
          <th>Last updated</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <ErrorRow error={error} span={6} />
        {rows.map((i) => (
          <tr key={i.id} className="q__row--click" onClick={() => navigate(`/items/${i.id}`)}>
            {/* Pricing takes the fee snapshot: it is what the payout will read,
                whatever the fee table says later. */}
            <ItemCell item={i} names={names} meta={`declared ${i.declaredGradeCode} · takes the fee snapshot`} />
            <td><span className="tg-badge tg-badge--accent">{i.assignedGradeCode}</span></td>
            <td className="q__num">{money(i.askingAmountMinor)}</td>
            <td className="q__num">{i.floorAmountMinor != null ? money(i.floorAmountMinor) : '—'}</td>
            <UpdatedCell at={i.updatedAt} />
            <td onClick={(e) => e.stopPropagation()}>
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
                    onClick={() => priceGuided(i.id)}
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
 * Live listings, with an inline reprice.
 *
 * Repricing is a staff action — the backend retakes the fee snapshot and tells
 * the seller — so it is here, not something a technician sees. The seller's
 * floor is shown and the input is held above it, because the backend refuses a
 * price under the floor (that is the seller's promised minimum) and a form that
 * lets you type a number it will only reject is a worse form.
 */
function ListedTable({ rows, reload }: { rows: ManagedListing[]; reload: () => void }) {
  const { busy, error, act } = useAction(reload)
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const save = (l: ManagedListing) => {
    const minor = Math.round(Number(draft[l.listingId]) * 100)
    act(l.listingId, async () => {
      await api.changeListingPrice(l.listingId, minor, 'staff_override')
      setOpen(null)
    })
  }

  return (
    <table className="q__table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Grade</th>
          <th>Seller</th>
          <th className="q__num">Floor</th>
          <th className="q__num">Price</th>
          <th>Last updated</th>
          <th>Reprice</th>
        </tr>
      </thead>
      <tbody>
        <ErrorRow error={error} span={7} />
        {rows.map((l) => {
          const belowFloor = l.floorMinor != null && Number(draft[l.listingId]) * 100 < l.floorMinor
          const valid = Number(draft[l.listingId]) > 0 && !belowFloor
          return (
            <tr key={l.listingId}>
              <td>
                <span className="ops__pic"><ModelPhoto modelId={l.productModelId} kind="gear" size="mini" alt="" badge={false} /></span>
                <Link to={`/listings/${l.listingId}`} className="ops__id">{l.title}</Link>
                <span className="ops__gear tg-mono">{l.internalSku}</span>
              </td>
              <td><span className="tg-badge tg-badge--accent">{l.gradeCode}</span></td>
              <td>{l.sellerName ?? '—'}</td>
              <td className="q__num">{l.floorMinor != null ? money(l.floorMinor) : '—'}</td>
              <td className="q__num"><strong>{money(l.priceMinor)}</strong></td>
              <UpdatedCell at={latest(l.updatedAt, l.listedAt)} />
              <td>
                {open === l.listingId ? (
                  <span className="ops__inline">
                    <input
                      className="tg-input ops__amount" type="number" min={1} autoFocus
                      placeholder="New price (₹)" aria-label={`New price for ${l.title}`}
                      value={draft[l.listingId] ?? ''}
                      onChange={(e) => setDraft({ ...draft, [l.listingId]: e.target.value })}
                    />
                    <button className="tg-button tg-button--primary" disabled={busy === l.listingId || !valid} onClick={() => save(l)}>
                      {busy === l.listingId ? 'Saving…' : 'Save'}
                    </button>
                    <button className="tg-button" onClick={() => setOpen(null)}>Cancel</button>
                    {belowFloor && <span className="ops__gear">below the seller's floor</span>}
                  </span>
                ) : (
                  <button className="tg-button" disabled={busy === l.listingId}
                    onClick={() => { setOpen(l.listingId); setDraft({ ...draft, [l.listingId]: String(Math.round(l.priceMinor / 100)) }) }}>
                    Change price
                  </button>
                )}
              </td>
            </tr>
          )
        })}
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
          <th>Last updated</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        <ErrorRow error={error} span={5} />
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
            <UpdatedCell at={latest(r.updatedAt, r.createdAt)} />
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
