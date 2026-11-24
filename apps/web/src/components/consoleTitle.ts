import { createContext, useContext, useEffect } from 'react'
import { api, useApi, type StaffHome } from '@trueglaz/core'

/**
 * The console's top bar carries each screen's title (TG-126), the way the
 * template does, instead of every page drawing its own heading under it. A
 * screen names itself with useConsoleTitle; one that does not still gets its
 * section's name from the route.
 */
export interface ConsoleTitle {
  title: string
  subtitle?: string
  /** The screen draws its own heading (a PageHead with actions): the shell draws none. */
  own?: boolean
}

export const ConsoleTitleContext = createContext<(t: ConsoleTitle | null) => void>(() => {})

export function useConsoleTitle(title: string, subtitle?: string, own = false) {
  const set = useContext(ConsoleTitleContext)
  useEffect(() => {
    set({ title, subtitle, own })
    return () => set(null)
  }, [set, title, subtitle, own])
}

/**
 * The Control room's figures, shared by the dashboard and the sidebar counts so
 * a badge and the tile it repeats always agree. Kept for half a minute; a
 * second screen asking within that time reads the same answer.
 */
let cached: { at: number; data: Promise<StaffHome> } | null = null
const TTL = 30_000

export function staffHomeOnce(force = false): Promise<StaffHome> {
  if (force || !cached || Date.now() - cached.at > TTL) {
    cached = { at: Date.now(), data: api.staffHome() }
    cached.data.catch(() => { cached = null })
  }
  return cached.data
}

/**
 * `fresh` asks the server again rather than reading the shared answer: the
 * Control room does, because its numbers are the ones a person clicks and
 * then compares with the list they open. The sidebar reads the shared answer.
 */
export function useStaffHome(enabled = true, fresh = false) {
  return useApi(() => (enabled ? staffHomeOnce(fresh) : Promise.resolve(null)), [enabled, fresh])
}

/** Drop the cached figures, e.g. after acting on a queue, so the next read is fresh. */
export function invalidateStaffHome() { cached = null }
