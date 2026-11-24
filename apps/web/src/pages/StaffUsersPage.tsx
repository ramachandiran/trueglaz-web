import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, dateOnly, dateTime, isAdmin, useApi, useSession, type StaffUserRow } from '@trueglaz/core'
import { PayoutReviewStrip } from '../components/PayoutCheckPanel'
import { QueueScreen } from '../components/QueueScreen'
import { PeopleTabs } from '../components/PeopleTabs'
import { KpiCard, KpiRow } from '../components/KpiCard'
import { Icon, ICONS } from '../components/StaffShell'
import { useQueryState } from '../components/useQueryState'
import { FactGrid, PanelSection, SidePanel } from '../components/SidePanel'
import './StaffUsersPage.css'

const GROUPS: Array<{ key: string; label: string; states: string[] | null }> = [
  // Opens on the work, not on the directory: the list is only interesting for
  // what it implies, and a staff member who has to filter before they can start
  // has been handed a table instead of a queue.
  { key: 'pending_review', label: 'Waiting on us', states: ['pending_review'] },
  { key: 'approved', label: 'Selling', states: ['approved'] },
  { key: 'rejected', label: 'Refused', states: ['rejected'] },
  { key: 'not_requested', label: 'Not asked', states: ['not_requested'] },
  { key: 'all', label: 'Everyone', states: null },
]

/**
 * Everyone on the platform, as a queue before a directory.
 *
 * It wears the same chrome as Inventory and Operations, and it reads the list
 * once rather than re-querying per filter — which is what makes the counts on
 * the tabs possible. A queue whose size you learn only by opening it is not
 * doing the one job a queue has.
 *
 * The decision is on the row. It used to be three clicks away: open the person,
 * read the page, press a button, go back — for an answer that is yes or no and
 * needs the two facts already in front of you, whether identity passed and
 * whether they have asked. The record is still a click away for the cases where
 * that is not enough, and it is where a note gets written.
 */
export function StaffUsersPage() {
  const { session } = useSession()
  const [view, setView] = useQueryState('view', 'pending_review')
  const [search, setSearch] = useQueryState('q')
  // TG-205: a name opens a quick view over the queue; the full record is one more click.
  const [peek, setPeek] = useQueryState('open')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const perPage = 10

  // Everybody, once. The filtering and the counts are both done here, so the
  // tab row cannot disagree with the table under it.
  const people = useApi(() => api.staffUsers('', ''), [])
  const rows = people.data ?? []

  const group = GROUPS.find((g) => g.key === view) ?? GROUPS[0]
  const inGroup = useMemo(
    () => (group.states === null ? rows : rows.filter((u) => group.states!.includes(u.sellingState))),
    [rows, group],
  )
  const countFor = (states: string[] | null) =>
    states === null ? rows.length : rows.filter((u) => states.includes(u.sellingState)).length

  const filtered = inGroup.filter((u) => {
    const t = search.trim().toLowerCase()
    if (!t) return true
    return [u.displayName, u.email, u.phone, ...u.roles]
      .some((v) => v?.toLowerCase().includes(t))
  })

  const pages = Math.ceil(filtered.length / perPage)
  const validPage = Math.min(Math.max(1, page), pages || 1)
  const shown = filtered.slice((validPage - 1) * perPage, validPage * perPage)

  async function decide(u: StaffUserRow, approve: boolean) {
    setBusy(u.userId); setError(null)
    try {
      if (approve) await api.approveSelling(u.userId)
      else await api.rejectSelling(u.userId)
      people.reload()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(null) }
  }

  return (
    <QueueScreen
      title="People"
      subtitle="Who is on the platform, and who may sell. A passed identity check is not a decision — this is."
      tabs={GROUPS.map((g) => ({ key: g.key, label: g.label, count: countFor(g.states) }))}
      active={group.key}
      onTab={(k) => { setView(k); setPage(1) }}
      search={search}
      onSearch={(v) => { setSearch(v); setPage(1) }}
      searchPlaceholder="Search by name, email or phone…"
      shown={filtered.length}
      total={inGroup.length}
      unit="people"
      loading={people.loading && !people.data}
      error={people.error}
      onRetry={people.reload}
      emptyTitle={group.key === 'pending_review' ? 'Nobody is waiting on a decision' : 'Nobody here'}
      emptyHint={group.key === 'pending_review'
        ? 'That is the queue being empty, not the page being broken.'
        : undefined}
      page={validPage}
      pages={pages}
      onPage={setPage}
      crumbs={[{ label: 'Control room', to: '/admin' }, { label: 'People' }]}
      headActions={<>
        <PeopleTabs />
        {isAdmin(session) && <Link to="/admin/people/team" className="c-btn c-btn--cta"><Icon d={ICONS.people} /> Invite staff</Link>}
      </>}
      summary={<>
        <KpiRow label="People by selling decision">
          {GROUPS.filter((g) => g.key !== 'not_requested').map((g, i) => {
            const n = countFor(g.states)
            const waiting = g.key === 'pending_review'
            return (
              <KpiCard key={g.key} icon={PEOPLE_ICON[g.key] ?? ICONS.people} lead={i === 0} title={g.label} value={n}
                pressed={group.key === g.key} onClick={() => { setView(g.key); setPage(1) }}
                tone={waiting && n > 0 ? 'warn' : undefined}
                chip={waiting ? (n > 0 ? <span className="c-chip2 c-chip2--warn"><Icon d={ICONS.clock} /> Decide</span> : <span className="c-chip2 c-chip2--good"><Icon d={ICONS.check} /> All decided</span>) : undefined}
                note={PEOPLE_NOTE[g.key]} />
            )
          })}
        </KpiRow>
        <PayoutReviewStrip /><DeletionStrip />
      </>}
    >
      <table className="q__table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Identity</th>
            <th>Selling</th>
            <th className="q__num">Activity</th>
            <th>Joined</th>
            <th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {error && (
            <tr><td colSpan={6}><p className="ppl__error" role="alert">{error}</p></td></tr>
          )}
          {shown.map((u) => (
            <tr key={u.userId}>
              <td>
                <button type="button" className="ppl__name ppl__peek" onClick={() => setPeek(u.userId)}>{u.displayName}</button>
                <span className="ppl__contact tg-muted">{u.email ?? u.phone ?? 'No contact'}</span>
                {u.roles.length > 0 && <span className="ppl__roles">{u.roles.join(' · ')}</span>}
              </td>
              <td><KycBadge status={u.kycStatus} /></td>
              <td><SellingBadge state={u.sellingState} /></td>
              <td className="q__num">
                <span className="ppl__count">{u.itemsListed || '—'} listed</span>
                <span className="ppl__count tg-muted">{u.ordersPlaced || '—'} bought</span>
              </td>
              <td className="tg-muted">{u.joinedAt ? dateOnly(u.joinedAt) : '—'}</td>
              <td>
                <Decision user={u} busy={busy === u.userId} onDecide={decide} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {peek && <PersonPeek id={peek} onClose={() => setPeek('')} onChanged={people.reload} />}
    </QueueScreen>
  )
}

/** One person at a glance (TG-205): identity, selling access, activity. */
function PersonPeek({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const d = useApi(() => api.staffUser(id), [id])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const u = d.data?.user
  const k = d.data?.kyc
  async function decide(approve: boolean) {
    setBusy(true); setErr(null)
    try {
      if (approve) await api.approveSelling(id, note); else await api.rejectSelling(id, note)
      setNote(''); d.reload(); onChanged()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'That did not work') } finally { setBusy(false) }
  }
  const canDecide = k?.status === 'verified'
  return (
    <SidePanel open onClose={onClose} eyebrow="Person" width={520}
      title={u?.displayName ?? (d.error ? 'Could not load' : 'Loading…')}
      subtitle={u ? <>{u.email ?? '—'} · {u.phone ?? '—'}</> : undefined}
      badges={u && <><KycBadge status={u.kycStatus} /><SellingBadge state={u.sellingState} />
        {u.accountState !== 'active' && <span className="c-chip2 c-chip2--bad">{u.accountState}</span>}</>}
      footer={<Link className="c-btn c-btn--navy c-btn--sm sp__foot-end" to={`/admin/people/${id}`}>Open full record</Link>}>
      {d.error && <p className="ppl__error" role="alert">{d.error.message}</p>}
      {u && <>
        <PanelSection title="Activity" tone="card">
          <FactGrid facts={[
            { label: 'Consigned', value: `${u.itemsListed} unit${u.itemsListed === 1 ? '' : 's'}` },
            { label: 'Bought', value: `${u.ordersPlaced} order${u.ordersPlaced === 1 ? '' : 's'}` },
            { label: 'Joined', value: u.joinedAt ? dateOnly(u.joinedAt) : '—' },
            { label: 'Roles', value: u.roles.length ? u.roles.join(' · ') : 'Customer' },
          ]} />
        </PanelSection>
        <PanelSection title="Identity check" tone="card">
          {k ? <FactGrid facts={[
            { label: 'Status', value: k.status.replace(/_/g, ' ') },
            { label: 'Document', value: k.idType ? `${k.idType === 'aadhaar' ? 'Aadhaar' : k.idType.toUpperCase()} ending ${k.idLast4 ?? '????'}` : '—' },
            { label: 'Name on the document', value: k.legalName ?? '—', wide: true },
            { label: 'Verified', value: k.verifiedAt ? dateTime(k.verifiedAt) : '—' },
            { label: 'Checked by', value: k.provider ?? '—' },
          ]} /> : <p className="tg-muted">Not started.</p>}
        </PanelSection>
        <PanelSection title="Selling access" tone="card">
          {d.data!.sellingDecidedAt && (
            <p className="ppl__peek-was">{u.sellingState.replace(/_/g, ' ')} by {d.data!.sellingDecidedBy ?? 'the system'} on {dateTime(d.data!.sellingDecidedAt)}
              {d.data!.sellingNote && <span className="tg-muted"> — “{d.data!.sellingNote}”</span>}</p>
          )}
          {canDecide ? <>
            <input className="tg-input" value={note} placeholder="Note kept with the decision" aria-label="Note kept with the decision" onChange={(e) => setNote(e.target.value)} />
            <div className="ppl__peek-act">
              <button className="c-btn c-btn--cta c-btn--sm" disabled={busy || u.sellingState === 'approved'} onClick={() => decide(true)}>
                {u.sellingState === 'approved' ? 'Already selling' : 'Let them sell'}</button>
              <button className="c-btn c-btn--sm" disabled={busy || u.sellingState === 'rejected'} onClick={() => decide(false)}>
                {u.sellingState === 'rejected' ? 'Already refused' : 'Refuse'}</button>
            </div>
          </> : <p className="tg-muted">Nothing to decide until the identity check has passed.</p>}
          {err && <p className="ppl__error" role="alert">{err}</p>}
        </PanelSection>
      </>}
    </SidePanel>
  )
}

/**
 * Account deletions (TG-125): who asked to leave and when they go, so support
 * can answer "did my request go through?" without a database query. Ids and
 * dates only: an erased account has no name left to show.
 */
function DeletionStrip() {
  const rows = useApi(() => api.staffAccountDeletions(), [])
  const [open, setOpen] = useState(false)
  const list = rows.data ?? []
  if (list.length === 0) return null
  const scheduled = list.filter((r) => r.state === 'scheduled')
  const deleted = list.length - scheduled.length
  return (
    <div className="ppl__deletions">
      <button className="tg-button tg-button--subtle" onClick={() => setOpen(!open)} aria-expanded={open}>
        Account deletions: {scheduled.length} scheduled · {deleted} erased {open ? '▴' : '▾'}
      </button>
      {open && (
        <table className="q__table">
          <thead><tr><th>Account</th><th>State</th><th>Asked</th><th>Erased / due</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.state === 'scheduled' ? <Link to={`/admin/people/${r.id}`}>{r.displayName}</Link> : <span className="tg-muted">{r.id.slice(-12)}</span>}</td>
                <td><span className={`tg-badge ${r.state === 'scheduled' ? 'tg-badge--warn' : ''}`}>{r.state}</span></td>
                <td className="tg-muted">{r.requestedAt ? dateOnly(r.requestedAt) : '—'}</td>
                <td>{r.deletedAt ? dateOnly(r.deletedAt) : r.dueAt ? dateOnly(r.dueAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/**
 * Yes or no, where it is a question — and the reason it is not, where it is not.
 *
 * Approving an unverified account is refused by the API and would mean nothing
 * if it were not, so the row says so rather than offering a button that 422s.
 */
function Decision({
  user, busy, onDecide,
}: { user: StaffUserRow; busy: boolean; onDecide: (u: StaffUserRow, approve: boolean) => void }) {
  if (user.sellingState !== 'pending_review') {
    return <Link to={`/admin/people/${user.userId}`} className="ppl__open">Full record →</Link>
  }
  if (user.kycStatus !== 'verified') {
    return (
      <span className="ppl__blocked tg-muted">
        Identity {user.kycStatus.replace(/_/g, ' ')}
      </span>
    )
  }
  return (
    <span className="ppl__decide">
      <button
        className="tg-button tg-button--primary"
        disabled={busy}
        onClick={() => onDecide(user, true)}
      >
        {busy ? 'Working…' : 'Let them sell'}
      </button>
      <button className="tg-button" disabled={busy} onClick={() => onDecide(user, false)}>
        Refuse
      </button>
    </span>
  )
}

export function KycBadge({ status }: { status: string }) {
  const tone = status === 'verified' ? 'good' : status === 'rejected' ? 'bad'
    : status === 'in_review' ? 'warn' : ''
  return <span className={`tg-badge${tone ? ` tg-badge--${tone}` : ''}`}>{label(status)}</span>
}

export function SellingBadge({ state }: { state: string }) {
  const tone = state === 'approved' ? 'good' : state === 'rejected' ? 'bad'
    : state === 'pending_review' ? 'warn' : ''
  return <span className={`tg-badge${tone ? ` tg-badge--${tone}` : ''}`}>{label(state)}</span>
}

/** snake_case is how the API says it; this is how a person reads it. */
function label(v: string) {
  return v.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

export type { StaffUserRow }

const PEOPLE_ICON: Record<string, string> = {
  pending_review: ICONS.clock, approved: ICONS.check, rejected: ICONS.close, all: ICONS.people,
}
const PEOPLE_NOTE: Record<string, string> = {
  pending_review: 'asked to sell; identity checked or pending',
  approved: 'may list gear',
  rejected: 'told why, can ask again',
  all: 'every account on the platform',
}
