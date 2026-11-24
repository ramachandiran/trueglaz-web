import { useEffect, useRef, useState } from 'react'
import { openStaffStream, type LiveNotice } from '@trueglaz/core'

export type LiveState = 'off' | 'connecting' | 'live'

/**
 * Keeps the console's live line open (TG-208) and hands each notification to
 * [onNotice] as it arrives.
 *
 * It reconnects by itself: two seconds after a drop, doubling to ten seconds,
 * and at once when the browser comes back online. A reconnect calls
 * [onReconnect], because anything sent while the line was down is in the bell,
 * not on the line: it is told when the line went down so it can catch up.
 */
export function useLiveLine(enabled: boolean, onNotice: (n: LiveNotice) => void, onReconnect: (downSince: number) => void): LiveState {
  const [state, setState] = useState<LiveState>('off')
  const notice = useRef(onNotice); notice.current = onNotice
  const reconnect = useRef(onReconnect); reconnect.current = onReconnect

  useEffect(() => {
    if (!enabled) { setState('off'); return }
    let stopped = false
    let ctrl: AbortController | null = null
    let wait = 2_000
    let timer: number | undefined
    let opened = false
    let downSince = 0

    const connect = async () => {
      if (stopped) return
      if (!navigator.onLine) { setState('connecting'); return } // the 'online' event brings us back
      setState('connecting')
      ctrl = new AbortController()
      try {
        await openStaffStream((n) => notice.current(n), () => {
          setState('live')
          wait = 2_000
          if (opened) reconnect.current(downSince)
          opened = true
          downSince = 0
        }, ctrl.signal)
      } catch { /* dropped or refused: try again below */ }
      if (stopped) return
      if (!downSince) downSince = Date.now()
      setState('connecting')
      timer = window.setTimeout(connect, wait)
      wait = Math.min(wait * 2, 10_000)
    }
    const online = () => { window.clearTimeout(timer); ctrl?.abort(); wait = 2_000; connect() }

    connect()
    window.addEventListener('online', online)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      window.removeEventListener('online', online)
      ctrl?.abort()
    }
  }, [enabled])

  return state
}
