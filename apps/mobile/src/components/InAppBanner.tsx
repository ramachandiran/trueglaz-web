import { useEffect, useRef, useState } from 'react'
import { Animated, PanResponder, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, type Notification } from '@trueglaz/core'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'
import { NATIVE, useReducedMotion } from './motion'
import { openLink, routeForLink } from '../linking'

/**
 * The in-app banner (TG-123): when something new arrives while the app is
 * open, a TrueGlaz card slides down from the top: what happened, tap to
 * open it, swipe up to put it away, gone by itself after a few seconds.
 *
 * It is driven by the notification inbox, not by the push itself, so it works
 * with push turned off too, and a push and the inbox can never show the same
 * thing twice. While the app is open the phone's own banner is switched off
 * (push.ts) so there is one banner, ours.
 */

type Shown = { kind: 'one'; n: Notification } | { kind: 'many'; count: number }
const listeners = new Set<(s: Shown) => void>()

/** Ids already on screen or seen in the inbox; the first load only records them. */
let known: Set<string> | null = null

/**
 * Called with the inbox every time it loads. Anything unread that was not
 * there last time is new; the first load of a session is the baseline.
 */
export function noteInbox(items: Notification[]) {
  if (!known) { known = new Set(items.map((n) => n.id)); return }
  const fresh = items.filter((n) => !known!.has(n.id) && !n.readAt)
  items.forEach((n) => known!.add(n.id))
  if (fresh.length === 0) return
  const s: Shown = fresh.length === 1 ? { kind: 'one', n: fresh[0] } : { kind: 'many', count: fresh.length }
  listeners.forEach((l) => l(s))
}

/** Signed out: the next person's first inbox is a fresh baseline. */
export function resetInbox() { known = null }

const ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  buying: 'cube', selling: 'pricetag', payouts: 'wallet', security: 'shield-checkmark', rewards: 'gift',
}
const HIDE_AFTER = 4500

export function InAppBanner({ navRef }: { navRef: { isReady: () => boolean; navigate: (...a: any[]) => void; getCurrentRoute: () => { name: string; params?: any } | undefined } }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const [shown, setShown] = useState<Shown | null>(null)
  const y = useRef(new Animated.Value(-160)).current
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    if (reduced) { y.setValue(-160); setShown(null); return }
    Animated.timing(y, { toValue: -160, duration: 220, useNativeDriver: NATIVE }).start(() => setShown(null))
  }
  const later = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(hide, HIDE_AFTER)
  }

  useEffect(() => {
    const l = (s: Shown) => {
      const here = navRef.isReady() ? navRef.getCurrentRoute() : undefined
      // Already looking at the inbox, or at the very thing it is about: no banner.
      if (here?.name === 'Notifications') return
      if (s.kind === 'one') {
        const r = routeForLink(s.n.link)
        if (r && 'screen' in r && here?.name === r.screen && here.params?.id && here.params.id === r.params?.id) return
      }
      setShown(s)
      y.setValue(-160)
      if (reduced) y.setValue(0)
      else Animated.spring(y, { toValue: 0, friction: 8, tension: 70, useNativeDriver: NATIVE }).start()
      later()
    }
    listeners.add(l)
    return () => { listeners.delete(l); if (timer.current) clearTimeout(timer.current) }
  }, [reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  // Swipe it up to dismiss; while a finger is on it, it stays.
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
    onPanResponderGrant: () => { if (timer.current) clearTimeout(timer.current) },
    onPanResponderMove: (_, g) => y.setValue(Math.min(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy < -30 || g.vy < -0.6) hide()
      else { Animated.spring(y, { toValue: 0, useNativeDriver: NATIVE }).start(); later() }
    },
  })).current

  if (!shown) return null

  const open = () => {
    hide()
    if (shown.kind === 'many') { navRef.navigate('Notifications'); return }
    api.markNotificationRead(shown.n.id).catch(() => {})
    if (shown.n.link) openLink(navRef, shown.n.link)
    else navRef.navigate('Notifications')
  }
  const icon = shown.kind === 'one' ? ICON[shown.n.category] ?? 'notifications' : 'notifications'
  const title = shown.kind === 'one' ? shown.n.title : `${shown.count} new updates`
  const body = shown.kind === 'one' ? shown.n.body : 'Tap to see them'

  return (
    <Animated.View {...pan.panHandlers} accessibilityLiveRegion="polite"
      style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, zIndex: 1000, elevation: 20, transform: [{ translateY: y }] }}>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${title}. ${body}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.colors.brand, borderRadius: 18, padding: 12, paddingRight: 8,
          shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.colors.cta, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={t.colors.onCta} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt numberOfLines={1} style={{ color: t.colors.onBrand, fontWeight: t.weight.bold as never, fontSize: t.size.sm }}>{title}</Txt>
          <Txt numberOfLines={2} style={{ color: t.colors.onBrandMuted, fontSize: t.size.xs, marginTop: 1 }}>{body}</Txt>
        </View>
        <Pressable onPress={hide} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss"
          style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={18} color={t.colors.onBrandMuted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  )
}
