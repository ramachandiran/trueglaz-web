import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** True when the phone asks for less motion. Animations then change colour, not position. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let live = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setReduced(v) }).catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => { live = false; sub.remove() }
  }, [])
  return reduced
}
