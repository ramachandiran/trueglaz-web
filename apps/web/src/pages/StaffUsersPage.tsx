import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, dateOnly, useApi, type StaffUserRow } from '@trueglaz/core'
import { ErrorNote, Loading } from '../components/ui'
import './StaffUsersPage.css'

const FILTERS = [
  { value: 'pending_review', label: 'Waiting on us' },
  { value: '', label: 'Everyone' },
  { value: 'approved', label: 'Selling' },
  { value: 'rejected', label: 'Refused' },
  { value: 'not_requested', label: 'Not asked' },
]

/**
 * Everyone on the platform, as a queue before a directory.
 *
 * It opens on the accounts waiting for a decision rather than on all of them:
 * the list is only interesting for the work it implies, and a staff member who
 * has to sort or search before they can start has been handed a table instead
 * of a queue.
 */
export function StaffUsersPage() {
  const [filter, setFilter] = useState('pending_review')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const users = useApi(() => api.staffUsers(search, filter), [search, filter])

  const rows = users.data ?? []

  return (
    <div className="people">
      <header className="people__head">
        <div>
          <h1 className="people__title">People</h1>
          <p className="tg-muted people__sub">
            Who is on the platform, and who may sell. An account that has passed its
            identity check still needs a decision here before it can consign anything.
          </p>
        </div>
      </header>

      <div className="people__controls">
        <div className="people__filters" role="tablist" aria-label="Filter by selling state">
          {FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              role="tab"
              aria-selected={filter === f.value}
              className={`people__filter${filter === f.value ? ' people__filter--on' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          className="people__search"
          onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()) }}
        >
          <input
            className="tg-input"
            value={q}
            placeholder="Name, email or phone"
            aria-label="Search people"
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="tg-button">Search</button>
          {search && (
            <button type="button" className="tg-button tg-button--subtle" onClick={() => { setQ(''); setSearch('') }}>
              Clear
            </button>
          )}
        </form>
      </div>

      {users.loading && !users.data && <Loading label="Loading people" />}
      {users.error && <ErrorNote error={users.error} onRetry={users.reload} />}

      {users.data && rows.length === 0 && (
        <p className="tg-muted people__empty">
          {filter === 'pending_review'
            ? 'Nobody is waiting on a decision. That is the queue being empty, not the page being broken.'
            : 'Nobody matches that.'}
        </p>
      )}

      {rows.length > 0 && (
        <table className="people__table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Identity</th>
              <th>Selling</th>
              <th className="people__num">Gear</th>
              <th className="people__num">Orders</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.userId}>
                <td>
                  <Link to={`/ops/users/${u.userId}`} className="people__name">{u.displayName}</Link>
                  <p className="tg-muted people__contact">{u.email ?? u.phone ?? 'No contact'}</p>
                  {u.roles.length > 0 && (
                    <span className="people__roles">{u.roles.join(' · ')}</span>
                  )}
                </td>
                <td><KycBadge status={u.kycStatus} /></td>
                <td><SellingBadge state={u.sellingState} /></td>
                <td className="people__num">{u.itemsListed || '—'}</td>
                <td className="people__num">{u.ordersPlaced || '—'}</td>
                <td className="tg-muted people__when">{u.joinedAt ? dateOnly(u.joinedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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
