import { useCallback, useEffect, useState } from 'react'
import { useActor } from '../state/ActorContext'
import type { Actor } from './client'

interface State<T> {
  data: T | null
  error: Error | null
  loading: boolean
}

/**
 * Minimal data fetching: enough for this app's read-mostly screens without
 * pulling in a query library. Refetches when the actor changes, because the
 * API answers differently depending on who is asking.
 */
export function useApi<T>(
  fetcher: (actor: Actor | null) => Promise<T>,
  deps: unknown[] = [],
): State<T> & { reload: () => void } {
  const { actor } = useActor()
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true })
  const [nonce, setNonce] = useState(0)

  // The fetcher is defined inline by callers, so it is intentionally not a dep;
  // `deps` is the caller's contract for when a refetch is needed.
  const run = useCallback(fetcher, deps)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))

    run(actor)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false })
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ data: null, error, loading: false })
      })

    return () => {
      cancelled = true
    }
  }, [run, actor, nonce])

  return { ...state, reload: () => setNonce((n) => n + 1) }
}
