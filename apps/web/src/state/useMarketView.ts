import { useEffect, useState } from 'react'

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
  const [view, setView] = useState<MarketView>(() => {
    try {
      return localStorage.getItem(KEY) === 'selling' ? 'selling' : 'buying'
    } catch {
      return 'buying'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, view)
    } catch {
      /* storage unavailable — the switch still works for this session */
    }
  }, [view])

  return { view, setView }
}
