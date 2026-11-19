import { getStorage } from './storage'

/**
 * Nothing is kept on the phone for offline viewing any more (TG-157): with no
 * connection the app shows one "You're offline" page and nothing else, so no
 * stale price, stock or order state is ever on screen.
 *
 * The TG-156 build did keep the last answer to each page. This wipes what it
 * left behind, on the next start and on sign-out, so an update removes it from
 * every phone. Safe to delete once no phone runs that build.
 */
export async function forgetOfflineCopies(userId: string): Promise<void> {
  try {
    const s = getStorage()
    const indexKey = `tg.c.idx.${userId}`
    const raw = await s.get(indexKey)
    if (!raw) return
    for (const e of JSON.parse(raw) as string[]) await s.remove(`tg.c.${userId}.${e}`)
    await s.remove(indexKey)
  } catch { /* nothing to forget */ }
}
