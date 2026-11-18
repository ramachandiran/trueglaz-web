import { useEffect, useState } from 'react'
import { onConnectivity, useOnline } from '@trueglaz/core'
import './OfflineNotice.css'

/**
 * A small notice while the browser is offline (TG-156), and "Back online" for
 * a moment when it returns; the pages fetch again by themselves. Anything that
 * needs the server (paying, saving) says it is offline instead of failing.
 */
export function OfflineNotice() {
  const online = useOnline()
  const [back, setBack] = useState(false)
  useEffect(() => onConnectivity((on) => {
    if (on) { setBack(true); setTimeout(() => setBack(false), 2500) }
  }), [])
  if (online && !back) return null
  return (
    <div className={`offline${online ? ' offline--back' : ''}`} role="status" aria-live="polite">
      {online ? 'Back online' : "You're offline. Pages you open now may be out of date, and paying or saving waits until you're back."}
    </div>
  )
}
