import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError, dateTime, useApi, type Notification } from '@trueglaz/core'
import { ErrorNote, Loading } from './ui'
import './NotificationsPanel.css'

/**
 * What has happened to the things you are selling or buying.
 *
 * Deliberately not a feed of everything: each row is something that happened to
 * one of this person's own items or orders, and the ones that need them to do
 * something are the reason it exists — a price waiting on their decision, a
 * payout held up for want of a verified account, an acceptance window running
 * down.
 *
 * Staff and admin never see anything here, and not because this hides it: the
 * API only ever writes a notification against the seller or buyer a row names.
 */

const GROUPS: { key: string; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'selling', label: 'Selling' },
  { key: 'buying', label: 'Buying' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'security', label: 'Security' },
  { key: 'rewards', label: 'Rewards' },
]

export function NotificationsPanel({ onChanged }: { onChanged?: () => void }) {
  const feed = useApi(() => api.notifications(), [])
  const [group, setGroup] = useState('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // Same rule as the rest of the profile page: only the first load takes over,
  // so marking one read does not flash a spinner over the list it just changed.
  if (feed.loading && !feed.data) {
    return (
      <section className="tg-card profile__section" id="notifications">
        <h2 className="profile__section-title">Notifications</h2>
        <Loading label="Loading your notifications" />
      </section>
    )
  }
  if (!feed.data) {
    return (
      <section className="tg-card profile__section" id="notifications">
        <h2 className="profile__section-title">Notifications</h2>
        {feed.error
          ? <ErrorNote error={feed.error} onRetry={feed.reload} />
          : <p className="tg-muted profile__blurb">Your notifications are not available right now.</p>}
      </section>
    )
  }

  const all = feed.data.items
  const unread = feed.data.unread
  const shown = group === 'all' ? all : all.filter((n) => n.category === group)

  // A tab with nothing behind it is a dead end, so only the ones that have
  // something are offered.
  const tabs = GROUPS.filter((g) => g.key === 'all' || all.some((n) => n.category === g.key))

  async function act(run: () => Promise<unknown>) {
    setBusy(true); setError(null)
    try {
      await run()
      await feed.reload()
      // The header badge reads off the profile, not this list.
      onChanged?.()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not do that')
    } finally { setBusy(false) }
  }

  /**
   * Opening one marks it read on the way.
   *
   * Navigating first and marking afterwards would lose the mark whenever the
   * new page unmounted this one mid-request, so the mark is awaited and the
   * navigation happens after.
   *
   * Then the list is reloaded only when this page is staying put. A security
   * notice links to /profile, which is the page the panel is already on, so
   * navigating there changes the URL without unmounting anything — and the row
   * stayed bold after being marked read, which looked exactly like the mark
   * having failed. Where the link really does go somewhere else, this component
   * is about to unmount and reloading it would be work thrown away.
   */
  async function open(n: Notification) {
    if (!n.readAt) {
      try {
        await api.markNotificationRead(n.id)
        onChanged?.()
      } catch {
        // Not worth stopping the navigation over: they still get where they
        // were going, and the row stays unread, which is the safe way to be wrong.
      }
    }
    if (goesElsewhere(n)) navigate(n.link!)
    else await feed.reload()
  }

  /**
   * Whether following this one actually takes you anywhere.
   *
   * A security notice links to /profile, which is where this panel lives, so on
   * this page it goes nowhere — and offering "Open" for it would be a promise
   * the click cannot keep.
   */
  function goesElsewhere(n: Notification): boolean {
    return !!n.link && n.link.split('#')[0] !== pathname
  }

  return (
    <section className="tg-card profile__section" id="notifications">
      <div className="notif__head">
        <h2 className="profile__section-title">
          Notifications
          {unread > 0 && <span className="notif__count" aria-label={`${unread} unread`}>{unread}</span>}
        </h2>
        {unread > 0 && (
          <button
            className="tg-button tg-button--subtle"
            disabled={busy}
            onClick={() => act(() => api.markAllNotificationsRead())}
          >
            {busy ? 'Working…' : 'Mark all as read'}
          </button>
        )}
      </div>

      <p className="tg-muted profile__blurb">
        Everything that has happened to the gear you are selling and the orders you
        have placed. We will tell you here when something needs you.
      </p>

      {tabs.length > 2 && (
        <div className="notif__tabs" role="tablist" aria-label="Filter notifications">
          {tabs.map((g) => {
            const n = g.key === 'all'
              ? all.filter((x) => !x.readAt).length
              : all.filter((x) => x.category === g.key && !x.readAt).length
            return (
              <button
                key={g.key}
                role="tab"
                aria-selected={group === g.key}
                className={`notif__tab${group === g.key ? ' notif__tab--on' : ''}`}
                onClick={() => setGroup(g.key)}
              >
                {g.label}
                {n > 0 && <span className="notif__tab-dot" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}

      {shown.length === 0 && (
        <p className="tg-muted profile__blurb notif__empty">
          {all.length === 0
            ? 'Nothing yet. When we grade something you sent in, price it, sell it or pay you, it will show up here.'
            : 'Nothing in this group.'}
        </p>
      )}

      <ul className="notif__list">
        {shown.map((n) => (
          <li key={n.id} className={`notif__row${n.readAt ? '' : ' notif__row--unread'}`}>
            <button
              className="notif__hit"
              onClick={() => open(n)}
              // A row with nowhere to go is still a button, because clicking it
              // is how you mark it read.
              aria-label={goesElsewhere(n) ? `${n.title} — open` : `${n.title} — mark as read`}
            >
              <span className="notif__line">
                {!n.readAt && <span className="notif__dot" aria-hidden="true" />}
                <span className="notif__title">{n.title}</span>
                <span className="tg-muted notif__when">{n.at ? dateTime(n.at) : ''}</span>
              </span>
              <span className="notif__body">{n.body}</span>
              <span className="notif__tagrow">
                <span className={`notif__tag notif__tag--${n.category}`}>
                  {GROUPS.find((g) => g.key === n.category)?.label ?? n.category}
                </span>
                {goesElsewhere(n) && <span className="notif__go">Open →</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="profile__error" role="alert">{error}</p>}
    </section>
  )
}
