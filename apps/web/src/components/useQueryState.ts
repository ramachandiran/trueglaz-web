import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * One piece of a screen's state kept in the address (TG-126): the tab, the
 * search, a filter a Control room widget opened it with. A link can then open
 * a list exactly as the widget described it, the back button undoes a tab
 * change, and a filtered view can be pasted to a colleague.
 *
 * Writes replace the history entry rather than adding one, so typing in a
 * search box does not leave a back-button trail of every letter.
 *
 * A change that also resets other parameters (a new tab drops the page and
 * the filter) names them in `reset` so it is ONE write: two writes in the
 * same click each start from the old address, and the second undoes the first.
 */
export function useQueryState(name: string, fallback = ''): [string, (v: string, reset?: string[]) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get(name) ?? fallback
  const set = useCallback((v: string, reset: string[] = []) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      reset.forEach((n) => next.delete(n))
      if (!v || v === fallback) next.delete(name)
      else next.set(name, v)
      return next
    }, { replace: true })
  }, [name, fallback, setParams])
  return [value, set]
}

/** Remove several parameters at once, e.g. "Clear filter". */
export function useClearParams() {
  const [, setParams] = useSearchParams()
  return useCallback((...names: string[]) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      names.forEach((n) => next.delete(n))
      return next
    }, { replace: true })
  }, [setParams])
}

/** A page number read from the address; anything that is not one is page 1. */
export function pageOf(page: string): number {
  const n = parseInt(page, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

/**
 * Scroll to the section the address names (#refunds, #kyc…) once the page has
 * drawn it, and mark it for a moment, so a link from a Control room count
 * lands on the queue it counted rather than at the top of a long page.
 */
export function useHashTarget(ready: boolean) {
  const { hash } = window.location
  useEffect(() => {
    if (!ready || !hash) return
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (!el) return
    // Once now and once more after the page has settled: a table above that
    // finishes drawing late would otherwise push the section back down.
    el.scrollIntoView({ block: 'start' })
    const again = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 500)
    el.classList.add('c-target')
    const t = setTimeout(() => el.classList.remove('c-target'), 2400)
    return () => { clearTimeout(t); clearTimeout(again) }
  }, [ready, hash])
}
