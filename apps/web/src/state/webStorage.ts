import type { Storage } from '@trueglaz/core'

/** The browser adapter for core's storage port. Async to match React Native's. */
export const webStorage: Storage = {
  async get(key) {
    try { return localStorage.getItem(key) } catch { return null }
  },
  async set(key, value) {
    try { localStorage.setItem(key, value) } catch { /* private mode */ }
  },
  async remove(key) {
    try { localStorage.removeItem(key) } catch { /* private mode */ }
  },
}
