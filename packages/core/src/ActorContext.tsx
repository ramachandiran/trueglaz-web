import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadActor, saveActor, type Actor } from './client'

interface Ctx {
  actor: Actor | null
  setActor: (a: Actor | null) => void
}

const ActorCtx = createContext<Ctx>({ actor: null, setActor: () => {} })

/**
 * Who the app is acting as.
 *
 * The API has no login yet — it trusts an X-Actor-Id / X-Actor-Role header pair.
 * This context is the single place that fiction lives, so when OTP and sessions
 * land, only this provider and `authHeaders` need to change.
 */
export function ActorProvider({ children }: { children: ReactNode }) {
  const [actor, setActorState] = useState<Actor | null>(null)

  // Storage is async on React Native, so the stored actor arrives after mount.
  useEffect(() => {
    let cancelled = false
    loadActor().then((a) => {
      if (!cancelled && a) setActorState(a)
    })
    return () => { cancelled = true }
  }, [])

  const value = useMemo<Ctx>(
    () => ({
      actor,
      setActor: (a) => {
        void saveActor(a)
        setActorState(a)
      },
    }),
    [actor],
  )

  return <ActorCtx.Provider value={value}>{children}</ActorCtx.Provider>
}

export const useActor = () => useContext(ActorCtx)
