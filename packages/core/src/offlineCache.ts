import { getStorage } from './storage'

/**
 * The last answer to each page someone opened, kept on the phone so the app
 * still shows their orders, wishlist and vault with no connection (TG-156).
 *
 * - Phone app only: the app turns it on. A website can be on a shared
 *   computer, and the browser keeps its own pages anyway.
 * - Per person: keyed by user id, and cleared when they sign out or the
 *   session ends, so the next person on the phone never sees it.
 * - Reads only: GET requests are cached; nothing is ever queued to send later,
 *   so a payment or an order cannot go through twice.
 * - Not everything: staff and admin screens, payout details, identity checks,
 *   one-time codes and private documents are never written down.
 * - Bounded: the most recent 80 pages per person.
 */
let enabled = false
const MAX = 80
const NEVER = [/^\/staff\b/, /^\/admin\b/, /^\/auth\b/, /^\/kyc\b/, /payout-account/, /\/export\b/, /^\/media\//, /^\/invoices\//, /\/documents?\//, /request-code/]

export function enableOfflineCache(on = true) { enabled = on }

export const cacheable = (endpoint: string) => enabled && !NEVER.some((r) => r.test(endpoint))

const key = (userId: string, endpoint: string) => `tg.c.${userId}.${endpoint}`
const indexKey = (userId: string) => `tg.c.idx.${userId}`

async function index(userId: string): Promise<string[]> {
  try { return JSON.parse((await getStorage().get(indexKey(userId))) ?? '[]') as string[] } catch { return [] }
}

/** Keep this answer as the latest for this page. Never throws. */
export async function rememberAnswer(userId: string, endpoint: string, text: string): Promise<void> {
  if (!cacheable(endpoint)) return
  try {
    const s = getStorage()
    await s.set(key(userId, endpoint), JSON.stringify({ at: Date.now(), text }))
    const list = (await index(userId)).filter((e) => e !== endpoint)
    list.push(endpoint)
    for (const old of list.splice(0, Math.max(0, list.length - MAX))) await s.remove(key(userId, old))
    await s.set(indexKey(userId), JSON.stringify(list))
  } catch { /* storage full or unavailable: the live answer was still shown */ }
}

/** The saved answer for this page, if there is one. */
export async function savedAnswer(userId: string, endpoint: string): Promise<{ at: number; text: string } | null> {
  if (!cacheable(endpoint)) return null
  try {
    const raw = await getStorage().get(key(userId, endpoint))
    return raw ? (JSON.parse(raw) as { at: number; text: string }) : null
  } catch { return null }
}

/** Forget everything kept for this person (sign-out, session ended, account deleted). */
export async function forgetAnswers(userId: string): Promise<void> {
  try {
    const s = getStorage()
    for (const e of await index(userId)) await s.remove(key(userId, e))
    await s.remove(indexKey(userId))
  } catch { /* nothing to forget */ }
}

// -- when what is on screen came from the phone, not the server ----------------

let savedAt: number | null = null
const savedListeners = new Set<(at: number | null) => void>()

/** The oldest saved answer shown since the connection went; null when everything is live. */
export const showingSavedSince = () => savedAt

export function noteSavedShown(at: number | null) {
  const next = at == null ? null : savedAt == null ? at : Math.min(savedAt, at)
  if (next === savedAt) return
  savedAt = next
  for (const fn of [...savedListeners]) fn(next)
}

export function onSavedShown(fn: (at: number | null) => void): () => void {
  savedListeners.add(fn)
  return () => { savedListeners.delete(fn) }
}
