import { useEffect, useState } from 'react'

/**
 * Whether the device has a connection, as the platform reports it (TG-156).
 *
 * Each app feeds this from its own source: the phone from expo-network, the
 * website from the browser's online/offline events. A failed request on its
 * own does not flip it: the API being down is not the person being offline,
 * and telling them to check their Wi-Fi then would send them the wrong way.
 */
let online = true
const listeners = new Set<(online: boolean) => void>()

export const isOnline = (): boolean => online

export function setOnline(next: boolean) {
  if (next === online) return
  online = next
  for (const fn of [...listeners]) fn(next)
}

/** Called with the new state whenever it changes. Returns an unsubscribe. */
export function onConnectivity(fn: (online: boolean) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function useOnline(): boolean {
  const [value, setValue] = useState(online)
  useEffect(() => {
    setValue(online)
    return onConnectivity(setValue)
  }, [])
  return value
}

/** Shown wherever an action needs the internet and there is none. */
export const OFFLINE_MESSAGE = "You're offline. Connect to the internet and try again."
