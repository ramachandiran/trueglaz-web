import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import { api, loadSession, onSessionExpired, saveSession } from './client'
import type { Session } from './types'

interface Ctx {
  session: Session | null
  /** Null while the stored session is being restored, so guards do not flash. */
  ready: boolean
  signIn: (session: Session) => Promise<void>
  signOut: () => Promise<void>
  /** Re-reads who we are, for when the person has just changed their own name or email. */
  refresh: () => Promise<void>
}

const SessionCtx = createContext<Ctx>({
  session: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {},
  refresh: async () => {},
})

/**
 * Holds the signed-in session.
 *
 * On boot the stored token is revalidated against /auth/me rather than trusted:
 * it may have expired or been revoked while the tab was closed, and a stale
 * session that only fails on the first real action is a worse experience than
 * one that sends you to sign in immediately.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const stored = await loadSession()
      if (!stored) {
        if (!cancelled) setReady(true)
        return
      }
      try {
        const me = await api.me()
        // Roles can change between visits; take the server's word for them.
        const refreshed: Session = { ...stored, ...me }
        await saveSession(refreshed)
        if (!cancelled) setSession(refreshed)
      } catch {
        await saveSession(null)
        if (!cancelled) setSession(null)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // A 401 from any call anywhere means the session is gone.
  useEffect(() => {
    onSessionExpired(() => setSession(null))
  }, [])

  const signIn = useCallback(async (next: Session) => {
    await saveSession(next)
    setSession(next)
  }, [])

  const signOut = useCallback(async () => {
    // Best effort: revoke server-side, but always clear locally.
    try { await api.logout() } catch { /* already gone */ }
    await saveSession(null)
    setSession(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const me = await api.me()
      setSession((current) => {
        if (!current) return current
        const next = { ...current, ...me }
        void saveSession(next)
        return next
      })
    } catch { /* a dead session is handled by the 401 path above */ }
  }, [])

  const value = useMemo<Ctx>(
    () => ({ session, ready, signIn, signOut, refresh }),
    [session, ready, signIn, signOut, refresh],
  )
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

export const useSession = () => useContext(SessionCtx)
