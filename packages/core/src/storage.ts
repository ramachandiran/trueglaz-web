/**
 * The one browser API the shared code needed.
 *
 * Web has localStorage; React Native has AsyncStorage and it is async. The
 * async shape is the common denominator, so core defines the port and each app
 * supplies the adapter.
 */
export interface Storage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** Used until an app installs its own; also the fallback when storage throws. */
export const memoryStorage = (): Storage => {
  const map = new Map<string, string>()
  return {
    async get(k) { return map.get(k) ?? null },
    async set(k, v) { map.set(k, v) },
    async remove(k) { map.delete(k) },
  }
}

let current: Storage = memoryStorage()

export function setStorage(s: Storage) { current = s }
export function getStorage(): Storage { return current }
