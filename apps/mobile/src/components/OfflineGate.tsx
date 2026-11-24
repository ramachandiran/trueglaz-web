import { useEffect, useRef, useState } from 'react'
import { Animated, BackHandler, Keyboard, Platform, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as Network from 'expo-network'
import { onConnectivity, setOnline, useOnline, useSession } from '@trueglaz/core'
import { Txt } from './Txt'
import { Button } from './form'
import { useTheme } from '../theme/ThemeContext'

/** A drop shorter than this is a blip (a lift, a tower hand-over): no page for it. */
const GRACE_MS = 1200

/**
 * With no connection, nothing in the app can be used (TG-157): one page covers
 * every screen, signed in or not, and takes every tap. Nothing is shown from
 * memory, so no stale price, stock or order state is ever on screen.
 *
 * - It sits over the screens rather than replacing them, so what someone was
 *   typing is still there when the connection comes back.
 * - They stay signed in; the screens fetch again by themselves on reconnect.
 * - Writes are refused by the API client while offline anyway; this page is
 *   what the person sees.
 */
export function useOfflineGate(): boolean {
  const online = useOnline()
  const [shown, setShown] = useState(!online)
  useEffect(() => {
    if (online) { setShown(false); return }
    const id = setTimeout(() => setShown(true), GRACE_MS)
    return () => clearTimeout(id)
  }, [online])
  return shown
}

export function OfflineGate({ shown }: { shown: boolean }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const [checking, setChecking] = useState(false)
  const [still, setStill] = useState(false)
  const [back, setBack] = useState(false)
  const fade = useRef(new Animated.Value(0)).current

  useEffect(() => onConnectivity((on) => {
    if (!on) return
    setBack(true)
    const id = setTimeout(() => setBack(false), 2500)
    return () => clearTimeout(id)
  }), [])

  useEffect(() => {
    if (!shown) { setStill(false); return }
    // Typing stops: the field it was going into is under this page.
    Keyboard.dismiss()
    // Back closes the app rather than moving through screens nobody can see.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { BackHandler.exitApp(); return true })
    return () => sub.remove()
  }, [shown])

  useEffect(() => {
    Animated.timing(fade, { toValue: shown ? 1 : 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start()
  }, [shown, fade])

  const retry = async () => {
    setChecking(true); setStill(false)
    try {
      const s = await Network.getNetworkStateAsync()
      const on = s.isConnected !== false && s.isInternetReachable !== false
      setOnline(on)
      if (!on) setStill(true)
    } catch { setStill(true) } finally { setChecking(false) }
  }

  if (!shown) {
    if (!back) return null
    return (
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 76, alignItems: 'center' }}>
        <View accessibilityRole="alert" accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.colors.good, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 }}>
          <Ionicons name="cloud-done-outline" size={16} color={t.colors.textInverted} />
          <Txt style={{ color: t.colors.textInverted, fontSize: t.size.sm, fontWeight: t.weight.medium as never }}>Back online</Txt>
        </View>
      </View>
    )
  }

  return (
    <Animated.View accessibilityViewIsModal accessibilityRole="alert" accessibilityLiveRegion="assertive"
      style={[StyleSheet.absoluteFill, { opacity: fade, backgroundColor: t.colors.bg, zIndex: 1000, elevation: 1000,
        paddingTop: insets.top, paddingBottom: insets.bottom, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border,
        alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <Ionicons name="cloud-offline-outline" size={44} color={t.colors.textMuted} />
      </View>
      <Txt accessibilityRole="header" style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never, textAlign: 'center' }}>
        You're offline
      </Txt>
      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.md, textAlign: 'center', marginTop: 10, maxWidth: 340 }}>
        TrueGlaz needs the internet. Turn on mobile data or Wi-Fi to carry on.
      </Txt>
      {session && (
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm, textAlign: 'center', marginTop: 8, maxWidth: 340 }}>
          You're still signed in, and anything you were typing is kept.
        </Txt>
      )}
      <View style={{ marginTop: 28, alignSelf: 'stretch', maxWidth: 340, width: '100%', marginHorizontal: 'auto' }}>
        <Button label={checking ? 'Checking…' : 'Try again'} variant="cta" loading={checking} onPress={retry} />
      </View>
      {still && (
        <Txt accessibilityLiveRegion="polite" style={{ color: t.colors.textMuted, fontSize: t.size.sm, textAlign: 'center', marginTop: 12 }}>
          Still no connection.
        </Txt>
      )}
    </Animated.View>
  )
}
