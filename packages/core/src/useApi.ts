import { useCallback, useEffect, useState } from 'react'
import { useSession } from './SessionContext'
import { onConnectivity } from './connectivity'

interface State<T> {
  data: T | null
  error: Error | null
  loading: boolean
}

/**
 * Minimal data fetching, enough for these screens without a query library.
 * Refetches when the signed-in user changes, because the API answers
 * differently depending on who is asking.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): State<T> & { reload: () => void } {
  const { session } = useSession()
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })
  const [nonce, setNonce] = useState(0)

  // The fetcher is defined inline by callers, so it is intentionally not a dep;
  // `deps` is the caller's contract for when a refetch is needed.
  const run = useCallback(fetcher, deps)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    run()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false })
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, error, loading: false })
      })

    return () => {
      cancelled = true
    }
  }, [run, session?.userId, nonce])

  // Back online: fetch again, so an error from while it was offline is
  // replaced by the live answer (TG-156, TG-157).
  useEffect(() => onConnectivity((online) => { if (online) setNonce((n) => n + 1) }), [])

  return { ...state, reload: () => setNonce((n) => n + 1) }
}
