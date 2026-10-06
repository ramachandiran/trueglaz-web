import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, dateOnly, useApi, type StaffUserRow } from '@trueglaz/core'
import { QueueScreen } from '../components/QueueScreen'
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
  const [view, setView] = useState('pending_review')
  const [search, setSearch] = useState('')
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
                <Link to={`/people/${u.userId}`} className="ppl__name">{u.displayName}</Link>
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
    </QueueScreen>
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
    return <Link to={`/people/${user.userId}`} className="ppl__open">Open record →</Link>
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
