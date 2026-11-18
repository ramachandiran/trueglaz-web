import { useEffect, useRef } from 'react'

/**
 * Close a dialog with the Escape key, as every dialog on the site should
 * (TG-144). The latest onClose is always the one called, and `enabled`
 * lets a dialog refuse while it is saving.
 */
export function useEscape(onClose: () => void, enabled = true) {
  const latest = useRef(onClose)
  latest.current = onClose
  useEffect(() => {
    if (!enabled) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') latest.current() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [enabled])
}
