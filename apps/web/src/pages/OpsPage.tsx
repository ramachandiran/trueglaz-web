import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  api, ApiError, dateOnly, dateTime, isStaff, money, relative, useApi, useSession,
  type ConsignmentItem, type InboundClock, type ManagedListing, type ReviewRequest, type Submission, type Technician,
} from '@trueglaz/core'
import { StateBadge } from '../components/ui'
import { QueueScreen } from '../components/QueueScreen'
import { pageOf, useClearParams, useQueryState } from '../components/useQueryState'
import { ActionDialog, Comment, Facts, Field, ReceiveDialog } from '../components/OpsDialogs'
import './OpsPage.css'

type Queue = 'intake' | 'inbound' | 'inspect' | 'price' | 'listed' | 'wanted'

/** How a widget's state filter reads in the "Showing …" line. */
const STATE_NAMES: Record<string, string> = {
  RECEIVED: 'Received, ready to inspect',
  AWAITING_INSPECTION: 'Queued for a technician',
  IN_INSPECTION: 'On the bench',
}

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
  const [tabParam, setTabParam] = useQueryState('tab', 'intake')
  const queue = tabParam as Queue
  const [search, setSearch] = useQueryState('q')
  const [pageParam, setPageParam] = useQueryState('page', '1')
  const page = pageOf(pageParam)
  const setPage = (n: number) => setPageParam(String(n))
  // Filters a Control room widget can open a queue with (TG-126).
  const [stateParam] = useQueryState('state')
  const [overdueParam] = useQueryState('overdue')
  // My bench (TG-203): a technician starts on their own units; staff on everyone's.
  const [benchParam, setBenchParam] = useQueryState('bench')
  // The outcome of a bulk action, kept here because the table reloads under it.
  const [notice, setNotice] = useState<{ text: string; bad: boolean } | null>(null)
  const clearParams = useClearParams()
  const perPage = 25

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
  const roster = useApi(() => api.technicians(), [])
  // The bench clock (TG-198): how long each unit has waited since it arrived, and the week's figures.
  const insights = useApi(() => api.staffInsights(), [])
  const arrived = useMemo(
    () => new Map((insights.data?.bench ?? []).map((b) => [b.itemId, b.receivedAt] as const)),
    [insights.data],
  )
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
  // TG-210: the seller's name on Intake and Inbound rows.
  const people = useApi(() => (staff ? api.staffUsers('', '') : Promise.resolve([])), [staff])
  const sellers = useMemo(() => new Map((people.data ?? []).map((u) => [u.userId, u.displayName])), [people.data])
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
               reload: () => { received.reload(); awaitingInspection.reload(); inInspection.reload(); insights.reload() } },
    price: graded,
    listed,
    wanted,
  }[active]

  const lateFor = (r: any): number =>
    r.items?.every((i: ConsignmentItem) => i.currentState === 'PRE_APPROVED') ? clock.get(r.id)?.daysOverdue ?? 0 : 0
  const stateSet = stateParam ? new Set(stateParam.split(',')) : null
  const widget = active === 'inspect' && stateSet
    ? { label: STATE_NAMES[stateParam] ?? stateParam.replace(/_/g, ' ').toLowerCase(), test: (r: any) => stateSet.has(r.currentState) }
    : active === 'inbound' && overdueParam
      ? { label: 'Boxes past their ship-by date', test: (r: any) => lateFor(r) > 0 }
      : null
  const bench = benchParam || (staff ? 'all' : 'mine')
  const mineOnly = active === 'inspect' && bench === 'mine'
  const rows: any[] = ((source.data as any[]) ?? [])
    .filter(widget?.test ?? (() => true))
    .filter((r) => !mineOnly || r.assignedTechnicianUserId === session?.userId)

  // One predicate per queue: the thing a person would actually type.
  const matches = (r: any) => {
    const t = search.trim().toLowerCase()
    if (!t) return true
    const hay = active === 'intake' ? [r.id, sellers.get(r.sellerUserId) ?? null]
      : active === 'inbound' ? [r.id, sellers.get(r.items[0]?.sellerUserId) ?? null, ...r.items.map((i: ConsignmentItem) => i.internalSku)]
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
  const lateness = (r: any): number => (active === 'inbound' ? lateFor(r) : 0)
  const sorted = [...filtered].sort((a, b) => lateness(b) - lateness(a) || timeOf(b) - timeOf(a))

  const pages = Math.ceil(sorted.length / perPage)
  const validPage = Math.min(Math.max(1, page), pages || 1)
  const shown = sorted.slice((validPage - 1) * perPage, validPage * perPage)

  const go = (next: string) => setTabParam(next, ['state', 'overdue', 'q', 'page'])
  const onSearch = (v: string) => setSearch(v, ['page'])

  const unit = active === 'intake' || active === 'inbound' ? 'submissions'
    : active === 'wanted' ? 'requests' : active === 'listed' ? 'listings' : 'items'
  const placeholder = active === 'intake' ? 'Search by seller or submission id…'
    : active === 'inbound' ? 'Search by seller, submission or SKU…'
    : active === 'wanted' ? 'Search what buyers asked for…'
    : active === 'listed' ? 'Search by item, SKU, grade or seller…'
      : 'Search by SKU, serial or grade…'
  const empty = {
    intake: 'Nothing waiting on approval',
    inbound: 'Nothing on its way in',
    inspect: 'Nothing to inspect',
    price: 'Nothing waiting on a price',
    listed: 'Nothing is on sale right now',
    wanted: 'Nothing waiting',
  }[active]

  return (
    <>
      <QueueScreen
        title={STAGE[active].title}
        subtitle={STAGE[active].line}
        crumbs={[{ label: 'Operations', to: '/admin/operations' }, { label: STAGE[active].title }]}
        actions={active === 'inspect' ? (
          <div className="ops__bench" role="group" aria-label="Whose units">
            <button type="button" aria-pressed={bench === 'mine'} onClick={() => setBenchParam(staff ? 'mine' : '', ['page'])}>
              My bench <span>{inspectRows.filter((i) => i.assignedTechnicianUserId === session?.userId).length}</span>
            </button>
            <button type="button" aria-pressed={bench === 'all'} onClick={() => setBenchParam(staff ? '' : 'all', ['page'])}>
              Everyone <span>{inspectRows.length}</span>
            </button>
          </div>
        ) : undefined}
        summary={active === 'inspect' && notice ? <>
          {notice && (
            <div className={`ops__notice${notice.bad ? ' ops__notice--bad' : ''}`} role="status">
              <span>{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">✕</button>
            </div>
          )}
        </> : undefined}
        filter={widget ? { label: widget.label, onClear: () => clearParams('state', 'overdue', 'page') } : null}
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
        emptyTitle={mineOnly ? 'Nothing on your bench' : empty}
        emptyHint={mineOnly ? 'Units assigned to you appear here. Switch to Everyone to see the whole bench.' : undefined}
        page={validPage}
        pages={pages}
        onPage={setPage}
      >
        {active === 'intake' && <IntakeTable rows={shown} names={names} sellers={sellers} reload={pending.reload} />}
        {active === 'inbound' && <InboundTable rows={shown} names={names} sellers={sellers} clock={clock} reload={source.reload} />}
        {active === 'inspect' && (
          <InspectTable rows={shown} names={names} roster={roster.data ?? []} staff={staff} onNotice={setNotice} arrived={arrived} windowHours={insights.data?.inspection.windowHours ?? 48} reload={source.reload} />
        )}
        {active === 'price' && <PricingTable rows={shown} names={names} reload={graded.reload} />}
        {active === 'listed' && <ListedTable rows={shown} reload={listed.reload} />}
        {active === 'wanted' && <RequestTable rows={shown} reload={wanted.reload} />}
      </QueueScreen>

    </>
  )
}

/** Each stage's heading and its one line (TG-198). */
const STAGE: Record<Queue, { title: string; line: string }> = {
  intake: { title: 'Intake', line: 'New submissions to approve or reject. A rejection gives the seller a reason.' },
  inbound: { title: 'Inbound', line: 'Boxes on their way to the hub. The one most past its ship-by date leads.' },
  inspect: { title: 'Inspection', line: 'Units on the bench, oldest first. Assign, inspect, grade or log defects.' },
  price: { title: 'Pricing', line: 'Graded units waiting on a price before they go on sale.' },
  listed: { title: 'Listed', line: 'Everything on sale now. Reprice without leaving Operations.' },
  wanted: { title: 'Requests', line: 'What buyers have asked for. Publish to the Wanted board or turn down.' },
}

/** Hours since a unit arrived, red past the window. */
function WaitingCell({ at, windowHours }: { at: string | null | undefined; windowHours: number }) {
  if (!at) return <td className="tg-muted">—</td>
  const h = Math.max(0, Math.floor((Date.now() - Date.parse(at)) / 3600000))
  const late = h > windowHours
  const text = h < 1 ? 'under 1 h' : h < 48 ? `${h} h` : `${Math.floor(h / 24)} d ${h % 24} h`
  return <td className={late ? "c-late ops__wait" : "ops__wait"} title={`Arrived ${dateTime(at)}`}>{text}{late && <span className="tg-visually-hidden"> (past {windowHours} hours)</span>}</td>
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

/** The rows' popups (TG-210): one open at a time, closed by Cancel, Esc or a done action. */
function useDialog() {
  const [dialog, setDialog] = useState<ReactNode>(null)
  return { dialog, open: setDialog, close: () => setDialog(null) }
}

/** Approve (with a comment on the record) or reject (with a reason the seller sees). */
function IntakeTable({ rows, names, sellers, reload }: { rows: Submission[]; names: Map<string, string>; sellers: Map<string, string>; reload: () => void }) {
  const d = useDialog()
  return (
    <>
      <table className="q__table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Seller</th>
            <th>Submitted</th>
            <th>Last updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => <IntakeRow key={s.id} s={s} names={names} seller={sellers.get(s.sellerUserId) ?? '—'} reload={reload} dialog={d} />)}
        </tbody>
      </table>
      {d.dialog}
    </>
  )
}

function IntakeRow({ s, names, seller, reload, dialog }: { s: Submission; names: Map<string, string>; seller: string; reload: () => void; dialog: ReturnType<typeof useDialog> }) {
  const navigate = useNavigate()
  const view = useApi(() => api.submission(s.id), [s.id])
  const items = view.data?.items ?? []
  const first = items[0]
  const name = first ? itemTitle(first, names) : null
  const title = first ? (name ?? first.internalSku) : 'Loading…'
  const asked = items.reduce((t, i) => t + i.askingAmountMinor, 0)
  const facts = (): Array<[string, ReactNode]> => [
    ['Seller', seller],
    ['Items', items.map((i) => `${itemTitle(i, names) ?? i.internalSku} (${i.internalSku})`).join(', ') || '—'],
    ['Asking', money(asked)],
    ['Submitted', s.submittedAt ? dateOnly(s.submittedAt) : '—'],
  ]

  return (
    <tr className={first ? 'q__row--click' : undefined} onClick={() => { if (first) navigate(`/items/${first.id}`) }}>
      <td>
        <span className="ops__model">{title}{items.length > 1 ? ` +${items.length - 1} more` : ''}</span>
        {first && (
          <span className="ops__gear">
            {name && <span className="tg-mono">{items.map((i) => i.internalSku).join(', ')} · </span>}
            {money(asked)} asked
          </span>
        )}
      </td>
      <td>{seller}</td>
      <td className="tg-muted">{s.submittedAt ? dateOnly(s.submittedAt) : '—'}</td>
      <UpdatedCell at={latest(s.updatedAt, s.submittedAt, s.createdAt)} />
      <td onClick={(e) => e.stopPropagation()}>
        <span className="ops__inline">
          <button className="tg-button tg-button--primary" disabled={!first} onClick={() => dialog.open(
            <ApproveDialog key={s.id} id={s.id} title={title} facts={facts()} onClose={dialog.close} onDone={reload} />,
          )}>Approve</button>
          <button className="tg-button" disabled={!first} onClick={() => dialog.open(
            <RejectSubmissionDialog key={s.id} id={s.id} title={title} facts={facts()} onClose={dialog.close} onDone={reload} />,
          )}>Reject</button>
        </span>
      </td>
    </tr>
  )
}

function ApproveDialog({ id, title, facts, onClose, onDone }: { id: string; title: string; facts: Array<[string, ReactNode]>; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  return (
    <ActionDialog title={`Approve ${title}?`} confirmLabel="Approve" ready={note.trim().length >= 3} onClose={onClose} onDone={onDone}
      run={() => api.preApprove(id, 'bluedart', note.trim())}>
      <Facts rows={facts} />
      <p className="opsd__hint">The seller gets a shipping label and a date to ship by.</p>
      <Comment required label="Comment" value={note} onChange={setNote} placeholder="Why it is approved (kept on the record)" />
    </ActionDialog>
  )
}

const INTAKE_REASON_LABELS: Record<string, string> = {
  insufficient_detail: 'Not enough detail to judge it',
  prohibited_item: 'Not something TrueGlaz accepts',
  price_unrealistic: 'Asking price far from what it sells for',
}

function RejectSubmissionDialog({ id, title, facts, onClose, onDone }: { id: string; title: string; facts: Array<[string, ReactNode]>; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  return (
    <ActionDialog title={`Reject ${title}?`} confirmLabel="Reject" destructive ready={!!reason} onClose={onClose} onDone={onDone}
      run={() => api.rejectSubmission(id, reason, note.trim() || undefined)}>
      <Facts rows={facts} />
      <Field label="Reason" required hint="The seller sees this.">
        <select className="tg-select" value={reason} onChange={(e) => setReason(e.target.value)} aria-required>
          <option value="">Choose a reason…</option>
          {INTAKE_REASONS.map((r) => <option key={r} value={r}>{INTAKE_REASON_LABELS[r] ?? r.replace(/_/g, ' ')}</option>)}
        </select>
      </Field>
      <Comment label="Note for the seller" value={note} onChange={setNote} placeholder="What exactly was wrong" />
    </ActionDialog>
  )
}

/**
 * What approval produced, shown where the box now waits: the courier and the
 * tracking number the seller is shipping under.
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

/** Boxes the hub is waiting on: receive one (with its details), give the seller more time, or lapse it. */
function InboundTable({
  rows, names, sellers, clock, reload,
}: {
  rows: Array<{ id: string; items: ConsignmentItem[] }>
  names: Map<string, string>
  sellers: Map<string, string>
  clock: Map<string, InboundClock>
  reload: () => void
}) {
  const navigate = useNavigate()
  const d = useDialog()
  return (
    <>
      <table className="q__table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Seller</th>
            <th>Ship by</th>
            <th>Status</th>
            <th>Last updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const first = r.items[0]
            const name = itemTitle(first, names)
            const title = name ?? first.internalSku
            const seller = sellers.get(first.sellerUserId) ?? '—'
            const c = clock.get(r.id)
            // Still at the seller's: the clock applies, so it can be extended or lapsed.
            const unposted = r.items.every((i) => i.currentState === 'PRE_APPROVED')
            const facts: Array<[string, ReactNode]> = [['Seller', seller], ['In the box', r.items.map((i) => i.internalSku).join(', ')], ['Ship by', c?.shipBy ? dateOnly(c.shipBy) : '—']]
            return (
              <tr key={r.id} className="q__row--click" onClick={() => navigate(`/items/${first.id}`)}>
                <td>
                  <span className="ops__model">{title}{r.items.length > 1 ? ` +${r.items.length - 1} more` : ''}</span>
                  <span className="ops__gear">
                    {name && <span className="tg-mono">{r.items.map((i) => i.internalSku).join(', ')} · </span>}
                    {r.items.length} item{r.items.length === 1 ? '' : 's'}
                  </span>
                  <InboundInfo submissionId={r.id} />
                </td>
                <td>{seller}</td>
                <ShipByCell clock={c} unposted={unposted} />
                <td><StateBadge state={first.currentState} /></td>
                <UpdatedCell at={latest(c?.updatedAt, ...r.items.map((i) => i.updatedAt))} />
                <td onClick={(e) => e.stopPropagation()}>
                  <span className="ops__inline">
                    <button className="tg-button tg-button--primary" onClick={() => d.open(
                      <ReceiveDialog key={r.id} submissionId={r.id} title={title} seller={seller} items={r.items} onClose={d.close} onDone={reload} />,
                    )}>Receive</button>
                    {unposted && c && (
                      <>
                        <button className="tg-button" onClick={() => d.open(
                          <ActionDialog key={r.id} title={`Give the seller 7 more days for ${title}?`} confirmLabel="Extend 7 days"
                            run={() => api.extendShipBy(r.id, 7)} onClose={d.close} onDone={reload}>
                            <Facts rows={facts} />
                            <p className="opsd__hint">The ship-by date moves on a week (from today if it has passed) and the seller is told.</p>
                          </ActionDialog>,
                        )}>Extend 7 days</button>
                        <button className="tg-button" onClick={() => d.open(
                          <ActionDialog key={r.id} title={`Lapse ${title} now?`} confirmLabel="Lapse it" destructive
                            run={() => api.lapseSubmission(r.id)} onClose={d.close} onDone={reload}>
                            <Facts rows={facts} />
                            <p className="opsd__hint">The label is voided and the seller is told. They can submit again.</p>
                          </ActionDialog>,
                        )}>Lapse now</button>
                      </>
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {d.dialog}
    </>
  )
}

/** Staff pick who inspects a received unit; the choice is confirmed in a popup. */
function AssignSelect({ item, title, roster, reload, dialog }: { item: ConsignmentItem; title: string; roster: Technician[]; reload: () => void; dialog: ReturnType<typeof useDialog> }) {
  const current = roster.find((t) => t.id === item.assignedTechnicianUserId)?.displayName
  return (
    <select
      className="tg-select"
      aria-label="Assign a technician"
      value={item.assignedTechnicianUserId ?? ''}
      onChange={(e) => {
        const id = e.target.value
        const who = roster.find((t) => t.id === id)?.displayName
        dialog.open(
          <ActionDialog key={`${item.id}-${id}`} title={id ? `Assign ${title} to ${who}?` : `Take ${title} off ${current ?? 'the bench'}?`}
            confirmLabel={id ? 'Assign' : 'Unassign'} run={() => api.assignTechnician(item.id, id || null)} onClose={dialog.close} onDone={reload}>
            <Facts rows={[['Unit', item.internalSku], ['Now with', current ?? 'nobody'], ['Goes to', who ?? 'nobody']]} />
            {id && <p className="opsd__hint">{who} is told straight away.</p>}
          </ActionDialog>,
        )
      }}
    >
      <option value="">Assign a technician…</option>
      {roster.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
    </select>
  )
}

/** Received and in progress in one list, because it is one bench. */
function InspectTable({
  rows, names, roster, staff, onNotice, arrived, windowHours, reload,
}: { rows: ConsignmentItem[]; names: Map<string, string>; roster: Technician[]; staff: boolean; onNotice: (n: { text: string; bad: boolean }) => void; arrived: Map<string, string | null>; windowHours: number; reload: () => void }) {
  const navigate = useNavigate()
  const d = useDialog()
  // Bulk work (TG-203): pick several received units, assign them or send them to the bench in one go.
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [bulkTech, setBulkTech] = useState('')
  const [bulk, setBulk] = useState<{ busy: boolean; done: number; total: number } | null>(null)
  const selectable = rows.filter((i) => i.currentState === 'RECEIVED')
  const chosen = selectable.filter((i) => picked.has(i.id))
  const allOn = selectable.length > 0 && chosen.length === selectable.length
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  async function runBulk(label: string, fn: (i: ConsignmentItem) => Promise<unknown>, items: ConsignmentItem[]) {
    const failed: { id: string; why: string }[] = []
    setBulk({ busy: true, done: 0, total: items.length })
    for (const [n, i] of items.entries()) {
      try { await fn(i) } catch (e) { failed.push({ id: i.id, why: e instanceof ApiError ? e.message : `${label} did not work` }) }
      setBulk({ busy: true, done: n + 1, total: items.length })
    }
    setBulk(null)
    // What failed stays picked, so it can be fixed and tried again.
    setPicked(new Set(failed.map((f) => f.id)))
    const ok = items.length - failed.length
    onNotice(failed.length === 0
      ? { text: `${label} done for all ${items.length} unit${items.length === 1 ? '' : 's'}.`, bad: false }
      : { text: `${ok} done, ${failed.length} not: ${failed[0].why}${failed.length > 1 ? ` (and ${failed.length - 1} more)` : ''}. They are still selected.`, bad: true })
    reload()
  }
  const sendable = chosen.filter((i) => i.assignedTechnicianUserId || bulkTech)
  const bench = (id?: string | null) => roster.find((t) => t.id === id)?.displayName ?? null
  const label = (i: ConsignmentItem) => itemTitle(i, names) ?? i.internalSku
  const list = (xs: ConsignmentItem[]) => xs.map((i) => i.internalSku).join(', ')

  return (
    <>
    {(chosen.length > 0 || bulk) && (
      <div className="ops__bulk" role="region" aria-label="Bulk actions">
        {chosen.length > 0 && <b>{chosen.length} selected</b>}
        {staff && chosen.length > 0 && (
          <>
            <select className="tg-select" aria-label="Assign the selected units to" value={bulkTech} onChange={(e) => setBulkTech(e.target.value)} disabled={bulk?.busy}>
              <option value="">Assign to…</option>
              {roster.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
            </select>
            <button type="button" className="c-btn c-btn--sm" disabled={!bulkTech || bulk?.busy} onClick={() => d.open(
              <ActionDialog key="bulk-assign" title={`Assign ${chosen.length} unit${chosen.length === 1 ? '' : 's'} to ${bench(bulkTech)}?`} confirmLabel={`Assign ${chosen.length}`}
                run={async () => { void runBulk('Assignment', (i) => api.assignTechnician(i.id, bulkTech), chosen) }} onClose={d.close}>
                <Facts rows={[['Units', list(chosen)], ['Technician', bench(bulkTech)]]} />
              </ActionDialog>,
            )}>Assign {chosen.length}</button>
            <button type="button" className="c-btn c-btn--sm c-btn--cta" disabled={sendable.length === 0 || bulk?.busy}
              title={sendable.length === 0 ? 'Assign a technician first' : undefined} onClick={() => d.open(
                <ActionDialog key="bulk-send" title={`Send ${sendable.length} unit${sendable.length === 1 ? '' : 's'} to inspection?`} confirmLabel={`Send ${sendable.length}`}
                  run={async () => {
                    void runBulk('Sending to inspection', async (i) => {
                      const tech = i.assignedTechnicianUserId ?? bulkTech
                      if (!i.assignedTechnicianUserId) await api.assignTechnician(i.id, tech)
                      await api.sendToInspection(i.id, tech)
                    }, sendable)
                  }} onClose={d.close}>
                  <Facts rows={[['Units', list(sendable)]]} />
                  <p className="opsd__hint">Each goes to its technician's bench to be inspected.</p>
                </ActionDialog>,
              )}>Send {sendable.length} to inspection</button>
          </>
        )}
        {bulk && <span className="ops__bulk-status" role="status">Working… {bulk.done} of {bulk.total}</span>}
        <button type="button" className="ops__bulk-clear" onClick={() => { setPicked(new Set()); setBulk(null) }}>Clear</button>
      </div>
    )}
    <table className="q__table">
      <thead>
        <tr>
          {staff && (
            <th className="ops__pick">
              <input type="checkbox" aria-label="Select every received unit" checked={allOn} disabled={selectable.length === 0}
                onChange={() => setPicked(allOn ? new Set() : new Set(selectable.map((i) => i.id)))} />
            </th>
          )}
          <th>Item</th>
          <th>Declared</th>
          <th>On the bench of</th>
          <th>Waiting</th>
          <th>Status</th>
          <th>Last updated</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((i) => (
          <tr key={i.id} className={`q__row--click${picked.has(i.id) ? ' ops__row--picked' : ''}`} onClick={() => navigate(`/items/${i.id}`)}>
            {staff && (
              <td className="ops__pick" onClick={(e) => e.stopPropagation()}>
                {i.currentState === 'RECEIVED'
                  ? <input type="checkbox" aria-label={`Select ${label(i)}`} checked={picked.has(i.id)} onChange={() => toggle(i.id)} />
                  : null}
              </td>
            )}
            <ItemCell item={i} names={names} />
            <td>{i.declaredGradeCode}</td>
            <td onClick={(e) => e.stopPropagation()}>
              {i.currentState === 'RECEIVED' && staff
                ? <AssignSelect item={i} title={label(i)} roster={roster} reload={reload} dialog={d} />
                : (bench(i.assignedTechnicianUserId) ?? <span className="tg-muted">unassigned</span>)}
            </td>
            <WaitingCell at={arrived.get(i.id)} windowHours={windowHours} />
            <td><StateBadge state={i.currentState} /></td>
            <UpdatedCell at={i.updatedAt} />
            <td onClick={(e) => e.stopPropagation()}>
              <span className="ops__inline">
                {i.currentState === 'IN_INSPECTION' ? (
                  // Already on the bench: the technician resumes their report.
                  <Link className="tg-button tg-button--primary" to={`/admin/operations/inspect/${i.id}`}>Continue →</Link>
                ) : i.currentState === 'AWAITING_INSPECTION' ? (
                  <button className="tg-button tg-button--primary" onClick={() => d.open(
                    <ActionDialog key={i.id} title={`Start inspecting ${label(i)}?`} confirmLabel="Start inspection"
                      run={() => api.startInspection(i.id)} onClose={d.close} onDone={() => navigate(`/admin/operations/inspect/${i.id}`)}>
                      <Facts rows={[['Unit', i.internalSku], ['Declared', i.declaredGradeCode], ['Bench', bench(i.assignedTechnicianUserId) ?? 'unassigned']]} />
                      <p className="opsd__hint">Opens the inspection report. Answers save as you go.</p>
                    </ActionDialog>,
                  )}>Start inspection</button>
                ) : (
                  <button className="tg-button tg-button--primary" disabled={!i.assignedTechnicianUserId}
                    title={i.assignedTechnicianUserId ? undefined : 'Assign a technician first'} onClick={() => d.open(
                      <ActionDialog key={i.id} title={`Send ${label(i)} to inspection?`} confirmLabel="Send to inspection"
                        run={() => api.sendToInspection(i.id, i.assignedTechnicianUserId!)} onClose={d.close} onDone={reload}>
                        <Facts rows={[['Unit', i.internalSku], ['Technician', bench(i.assignedTechnicianUserId) ?? '—']]} />
                      </ActionDialog>,
                    )}>Send to inspection</button>
                )}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    {d.dialog}
    </>
  )
}

/** Graded items waiting on a price: the guided price, or one set by hand with the reason. */
function PricingTable({ rows, names, reload }: { rows: ConsignmentItem[]; names: Map<string, string>; reload: () => void }) {
  const navigate = useNavigate()
  const d = useDialog()
  const label = (i: ConsignmentItem) => itemTitle(i, names) ?? i.internalSku
  const facts = (i: ConsignmentItem): Array<[string, ReactNode]> => [
    ['Unit', i.internalSku], ['Grade', i.assignedGradeCode ?? '—'], ['Seller asked', money(i.askingAmountMinor)],
    ['Seller floor', i.floorAmountMinor != null ? money(i.floorAmountMinor) : '—'],
  ]
  return (
    <>
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
          {rows.map((i) => (
            <tr key={i.id} className="q__row--click" onClick={() => navigate(`/items/${i.id}`)}>
              {/* Pricing takes the fee snapshot: it is what the payout will read, whatever the fee table says later. */}
              <ItemCell item={i} names={names} meta={`declared ${i.declaredGradeCode} · takes the fee snapshot`} />
              <td><span className="tg-badge tg-badge--accent">{i.assignedGradeCode}</span></td>
              <td className="q__num">{money(i.askingAmountMinor)}</td>
              <td className="q__num">{i.floorAmountMinor != null ? money(i.floorAmountMinor) : '—'}</td>
              <UpdatedCell at={i.updatedAt} />
              <td onClick={(e) => e.stopPropagation()}>
                <span className="ops__inline">
                  <button className="tg-button tg-button--primary" onClick={() => d.open(
                    <ActionDialog key={i.id} title={`Use the guided price for ${label(i)}?`} confirmLabel="Use guided price"
                      run={async () => {
                        try { await api.propose(i.id, {}) } catch (e) {
                          if (e instanceof ApiError && /guided price/i.test(e.message)) throw new Error('There is no guided price for this model and grade yet. Cancel and use "By hand".')
                          throw e
                        }
                      }} onClose={d.close} onDone={reload}>
                      <Facts rows={facts(i)} />
                      <p className="opsd__hint">The price comes from recent sales of this model and grade. The seller is asked to accept it.</p>
                    </ActionDialog>,
                  )}>Use the guided price</button>
                  <button className="tg-button" onClick={() => d.open(
                    <PriceByHandDialog key={i.id} item={i} title={label(i)} facts={facts(i)} onClose={d.close} onDone={reload} />,
                  )}>By hand</button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {d.dialog}
    </>
  )
}

function PriceByHandDialog({ item, title, facts, onClose, onDone }: { item: ConsignmentItem; title: string; facts: Array<[string, ReactNode]>; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const minor = Math.round(Number(amount) * 100)
  return (
    <ActionDialog title={`Price ${title} by hand`} confirmLabel="Set price" ready={minor > 0 && reason.trim().length >= 3} onClose={onClose} onDone={onDone}
      run={() => api.propose(item.id, { staffAmountMinor: minor, staffOverrideReason: reason.trim() })}>
      <Facts rows={facts} />
      <Field label="Price (₹)" required>
        <input className="tg-input" type="number" min={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-required />
      </Field>
      <Comment required label="Why this price" value={reason} onChange={setReason} placeholder="e.g. Priced off comparable recent sales" />
    </ActionDialog>
  )
}

/**
 * Live listings, repriced in a popup. The seller's floor is shown and the new
 * price held above it, because the backend refuses one under the floor.
 */
function ListedTable({ rows, reload }: { rows: ManagedListing[]; reload: () => void }) {
  const d = useDialog()
  return (
    <>
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
          {rows.map((l) => (
            <tr key={l.listingId}>
              <td>
                <Link to={`/listings/${l.listingId}`} className="ops__id">{l.title}</Link>
                <span className="ops__gear tg-mono">{l.internalSku}</span>
              </td>
              <td><span className="tg-badge tg-badge--accent">{l.gradeCode}</span></td>
              <td>{l.sellerName ?? '—'}</td>
              <td className="q__num">{l.floorMinor != null ? money(l.floorMinor) : '—'}</td>
              <td className="q__num"><strong>{money(l.priceMinor)}</strong></td>
              <UpdatedCell at={latest(l.updatedAt, l.listedAt)} />
              <td>
                <button className="tg-button" onClick={() => d.open(<RepriceDialog key={l.listingId} l={l} onClose={d.close} onDone={reload} />)}>
                  Change price
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {d.dialog}
    </>
  )
}

function RepriceDialog({ l, onClose, onDone }: { l: ManagedListing; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(Math.round(l.priceMinor / 100)))
  const minor = Math.round(Number(amount) * 100)
  const belowFloor = l.floorMinor != null && minor < l.floorMinor
  return (
    <ActionDialog title={`Change the price of ${l.title}?`} confirmLabel="Change price" ready={minor > 0 && !belowFloor && minor !== l.priceMinor}
      onClose={onClose} onDone={onDone} run={() => api.changeListingPrice(l.listingId, minor, 'staff_override')}>
      <Facts rows={[['Unit', l.internalSku], ['Seller', l.sellerName ?? '—'], ['Now', money(l.priceMinor)], ['Seller floor', l.floorMinor != null ? money(l.floorMinor) : '—']]} />
      <Field label="New price (₹)" required hint={belowFloor ? "Below the seller's floor; it would be refused." : 'The seller is told.'}>
        <input className="tg-input" type="number" min={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={belowFloor} />
      </Field>
    </ActionDialog>
  )
}

/**
 * What buyers have asked for, waiting to go on the public board. Nothing
 * reaches the board unread: an unmoderated noticeboard on a marketplace becomes
 * a channel for off-platform deals within a week.
 */
function RequestTable({ rows, reload }: { rows: ReviewRequest[]; reload: () => void }) {
  const d = useDialog()
  const facts = (r: ReviewRequest): Array<[string, ReactNode]> => [
    ['Wanted', r.wanted], ['Up to', r.maxPriceMinor != null ? money(r.maxPriceMinor) : '—'], ['Note', r.note ? `“${r.note}”` : '—'],
  ]
  return (
    <>
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
                <span className="ops__inline">
                  <button className="tg-button tg-button--primary" onClick={() => d.open(
                    <ActionDialog key={r.id} title="Put this on the Wanted board?" confirmLabel="Put on the board"
                      run={() => api.publishRequest(r.id)} onClose={d.close} onDone={reload}>
                      <Facts rows={facts(r)} />
                      <p className="opsd__hint">Everyone can read it once it is on the board.</p>
                    </ActionDialog>,
                  )}>Put on the board</button>
                  <button className="tg-button" onClick={() => d.open(
                    <TurnDownDialog key={r.id} r={r} facts={facts(r)} onClose={d.close} onDone={reload} />,
                  )}>Turn down</button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {d.dialog}
    </>
  )
}

function TurnDownDialog({ r, facts, onClose, onDone }: { r: ReviewRequest; facts: Array<[string, ReactNode]>; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <ActionDialog title="Turn this request down?" confirmLabel="Turn down" destructive ready={!!reason} onClose={onClose} onDone={onDone}
      run={() => api.rejectRequest(r.id, reason)}>
      <Facts rows={facts} />
      <Field label="Reason" required hint="The buyer sees this.">
        <select className="tg-select" value={reason} onChange={(e) => setReason(e.target.value)} aria-required>
          <option value="">Choose a reason…</option>
          {REJECT_REASONS.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
        </select>
      </Field>
    </ActionDialog>
  )
}
