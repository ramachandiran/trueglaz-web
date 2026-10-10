import { useCallback, useState } from 'react'

export type MarketView = 'buying' | 'selling'

const KEY = 'trueglaz.view'

/**
 * Which side of the market the person is looking at.
 *
 * A view, not an identity. Nobody is asked to choose what they are — a seller
 * is whoever passed the identity check — and switching is one click that gates
 * nothing, so a wrong guess costs nothing to undo. Buying is the default
 * because browsing is the act that asks for no commitment.
 *
 * Remembered per device rather than on the account: which side you were last
 * looking at is a fact about this browser, not about you, and a seller who
 * checks their payouts on a phone should not find the laptop switched over.
 */
export function useMarketView() {
  const [view, setViewState] = useState<MarketView>(() => storedMarketView() ?? 'buying')

  // Saved only when someone actually switches, and at once rather than in an
  // effect: the switch navigates in the same click, and the home route reads
  // this to decide which home to show. Saving the default on first render
  // would also make "never chose" look like "chose Buying", and a seller who
  // never touched the switch would stop landing on their selling home.
  const setView = useCallback((next: MarketView) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* storage unavailable — the switch still works for this session */
    }
    setViewState(next)
  }, [])

  return { view, setView }
}

/** The side last chosen on this device, or null if it has never been chosen. */
export function storedMarketView(): MarketView | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'selling' || v === 'buying' ? v : null
  } catch {
    return null
  }
}
