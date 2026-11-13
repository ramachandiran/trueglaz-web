import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Platform, View, type StyleProp, type ViewStyle } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * The app's motion kit (TG-120): one set of speeds and easings, so every
 * movement feels like the same product. Built on React Native's own Animated,
 * no extra native library. Everything checks the phone's "Reduce motion"
 * setting and, when it is on, shows the final state without moving.
 */
export const MOTION = { fast: 180, base: 280, slow: 450, stagger: 60 } as const
export const EASE_OUT = Easing.out(Easing.cubic)
/** Transform and opacity run on the native thread; width/height cannot. */
export const NATIVE = Platform.OS !== 'web'

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let live = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setReduced(v) }).catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => { live = false; sub?.remove?.() }
  }, [])
  return reduced
}

/** Fades and lifts its children in; `index` staggers a list (capped so long lists do not wait). */
export function FadeIn({ children, index = 0, delay = 0, from = 12, style }: {
  children: React.ReactNode; index?: number; delay?: number; from?: number; style?: StyleProp<ViewStyle>
}) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) { v.setValue(1); return }
    const a = Animated.timing(v, { toValue: 1, duration: MOTION.base, delay: delay + Math.min(index, 8) * MOTION.stagger, easing: EASE_OUT, useNativeDriver: NATIVE })
    a.start()
    return () => a.stop()
  }, [reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  )
}

/** Springs its children in from small: for a tick, a badge, a chip that just appeared. */
export function Pop({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) { v.setValue(1); return }
    const a = Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, friction: 5, tension: 140, useNativeDriver: NATIVE })])
    a.start()
    return () => a.stop()
  }, [reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
      {children}
    </Animated.View>
  )
}

/** A soft ring that breathes out from behind something "live" (the current step, a moving order). */
export function PulseRing({ size, color, radius, delay = 0 }: { size: number; color: string; radius?: number; delay?: number }) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: NATIVE }),
      Animated.delay(300),
    ]))
    // Wait for whatever it surrounds to arrive before breathing.
    const a = Animated.sequence([Animated.delay(delay), loop])
    a.start()
    return () => { a.stop(); v.setValue(0) }
  }, [reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  if (reduced) return null
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', width: size, height: size, borderRadius: radius ?? size / 2, backgroundColor: color,
      opacity: v.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 0.45, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
    }} />
  )
}

/** A status dot with its pulse, for lists and cards. */
export function LiveDot({ color, size = 8, live = true }: { color: string; size?: number; live?: boolean }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {live && <PulseRing size={size} color={color} />}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  )
}

/** 0 → 1 over `duration` after `delay`; for fills whose size is a percentage (not native-driven). */
export function useFill(delay = 0, duration: number = MOTION.slow, deps: unknown[] = []): Animated.Value {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) { v.setValue(1); return }
    v.setValue(0)
    const a = Animated.timing(v, { toValue: 1, duration, delay, easing: EASE_OUT, useNativeDriver: false })
    a.start()
    return () => a.stop()
  }, [reduced, delay, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  return v
}

// -- "has this order moved since you last looked?" -------------------------

const SEEN_KEY = 'tg.orderSeen.v1'
let seen: Record<string, string> | null = null
let loading: Promise<Record<string, string>> | null = null
const listeners = new Set<() => void>()

function loadSeen(): Promise<Record<string, string>> {
  if (seen) return Promise.resolve(seen)
  loading ??= AsyncStorage.getItem(SEEN_KEY)
    .then((raw) => (seen = raw ? JSON.parse(raw) : {}))
    .catch(() => (seen = {}))
  return loading.then(() => seen!)
}
function saveSeen() {
  AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen ?? {})).catch(() => {})
  listeners.forEach((l) => l())
}

/** One string for where an order stands; any change to it counts as "moved". */
export function statusKey(orderState: string, lineState?: string | null, cancelRequested?: boolean): string {
  return `${orderState}/${lineState ?? ''}${cancelRequested ? '/cancel' : ''}`
}

/**
 * Compare an order's status with the last one this phone showed the buyer.
 *
 * `peek` (lists, the home card) marks a change without clearing it, so the
 * "Updated" chip stays until the order itself is opened; the first sight of
 * an order only records it. `commit` (the order screen) reports the change
 * once, with the status it moved from, and then remembers the new one so the
 * movement does not replay.
 */
export function useStatusChange(id: string | undefined, key: string | undefined, mode: 'peek' | 'commit'):
  { ready: boolean; changed: boolean; from: string | null } {
  const [state, setState] = useState<{ ready: boolean; changed: boolean; from: string | null }>({ ready: false, changed: false, from: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const l = () => setTick((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  useEffect(() => {
    if (!id || !key) return
    let live = true
    loadSeen().then((s) => {
      if (!live) return
      const prev = s[id]
      const changed = !!prev && prev !== key
      if (mode === 'commit') {
        // Report once; a re-render after saving must not wipe what we just showed.
        setState((cur) => (cur.ready && cur.changed ? cur : { ready: true, changed, from: changed ? prev : null }))
        if (prev !== key) { s[id] = key; saveSeen() }
      } else {
        setState({ ready: true, changed, from: changed ? prev : null })
        if (!prev) { s[id] = key; saveSeen() }
      }
    })
    return () => { live = false }
  }, [id, key, mode, tick])
  return state
}
