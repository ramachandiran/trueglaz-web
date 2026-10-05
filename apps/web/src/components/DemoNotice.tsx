import { useEffect, useState } from 'react'
import { api } from '@trueglaz/core'
import './DemoNotice.css'

/**
 * Says so, where the money is not real.
 *
 * demo.trueglaz.com is reachable by anyone, and on it the payment gateway is a
 * stub that approves every payment. Somebody who finds the site, signs up and
 * "buys" a camera has to know before they do that nothing was charged and
 * nothing is coming. Everything else there is genuine — the grading, the
 * consignment flow, the ledger — which is exactly what makes it convincing
 * enough to need saying.
 *
 * Driven by the API rather than a build flag: it reads the payment provider
 * that is actually wired, so configuring a real gateway removes this notice by
 * itself and no deploy can forget to.
 *
 * Renders nothing at all until the answer is in. A banner that flashes up on a
 * live site for one render, even briefly, is worse than one that arrives a beat
 * late.
 */
export function DemoNotice() {
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    let live = true
    // Failure is silence. If this call does not come back, the app is already in
    // trouble and an alarming red strip about it helps nobody.
    api.meta().then(m => { if (live) setDemo(!m.paymentsAreReal) }).catch(() => {})
    return () => { live = false }
  }, [])

  if (!demo) return null

  return (
    <div className="demo-notice" role="status">
      <strong>Demo environment.</strong>{' '}
      Nothing here is for sale. Payments are simulated, no card is charged, and no
      item will be shipped.
    </div>
  )
}
