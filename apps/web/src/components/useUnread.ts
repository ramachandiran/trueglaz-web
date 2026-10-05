import { useCallback, useEffect, useState } from 'react'
import { api, useSession } from '@trueglaz/core'

/**
 * How often to ask whether anything new has arrived.
 *
 * A minute. The thing being watched is a staff member approving a price or a
 * payout going out, which happens on human timescales, and the query behind it
 * is a count over a partial index of unread rows — but it is still a request per
 * minute per open tab, so it stops when the tab is not being looked at.
 */
export const POLL_MS = 60_000

/**
 * The unread count, kept current without a page reload.
 *
 * Fetched on mount, then on a timer, then again the moment the tab is looked at
 * again. The last of those is what makes it feel live: somebody who leaves the
 * tab open for an hour and comes back gets the true count immediately rather
 * than up to a minute of staleness, and a backgrounded tab costs nothing in the
 * meantime.
 *
 * There is no push here. A websocket or SSE channel would deliver these the
 * instant they happen, and is the right answer eventually; polling a count is
 * what pays for itself today.
 */
export function useUnread(): { unread: number; refresh: () => void } {
  const { session } = useSession()
  const [unread, setUnread] = useState(0)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!session) { setUnread(0); return }
    let alive = true

    const read = () => {
      if (document.hidden) return
      api.profile()
        .then((p) => { if (alive) setUnread(p.unreadNotifications ?? 0) })
        // A header count is not worth an error state. Leaving the last known
        // number alone beats flashing a zero at somebody whose network blipped.
        .catch(() => {})
    }

    read()
    const timer = window.setInterval(read, POLL_MS)
    // Coming back to the tab is the moment the count is most likely wrong and
    // most likely to be looked at.
    document.addEventListener('visibilitychange', read)
    window.addEventListener('focus', read)

    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', read)
      window.removeEventListener('focus', read)
    }
  }, [session?.userId, tick])

  return { unread, refresh }
}
