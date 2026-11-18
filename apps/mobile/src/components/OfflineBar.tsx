import { useEffect, useRef, useState } from 'react'
import { Animated, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { noteSavedShown, onConnectivity, onSavedShown, showingSavedSince, useOnline } from '@trueglaz/core'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'

/**
 * A small pill above the tab bar while the phone has no connection (TG-156):
 * "You're offline", and, once a screen is showing the copy kept on the phone,
 * when that copy is from. When the connection is back it says so for a moment
 * and goes; the screens fetch again by themselves.
 *
 * It does not take taps: everything under it keeps working.
 */
export function OfflineBar() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const online = useOnline()
  const [savedAt, setSavedAt] = useState<number | null>(showingSavedSince())
  const [back, setBack] = useState(false)
  const shown = useRef(new Animated.Value(online ? 0 : 1)).current

  useEffect(() => onSavedShown(setSavedAt), [])
  useEffect(() => onConnectivity((on) => {
    if (on) {
      noteSavedShown(null)
      setBack(true)
      setTimeout(() => setBack(false), 2500)
    }
  }), [])
  useEffect(() => {
    Animated.timing(shown, { toValue: !online || back ? 1 : 0, duration: 220, useNativeDriver: true }).start()
  }, [online, back, shown])

  if (online && !back) return null
  const time = savedAt ? new Date(savedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : null
  const label = online
    ? 'Back online'
    : time ? `You're offline · showing what was saved at ${time}` : "You're offline"

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 76, alignItems: 'center', paddingHorizontal: 16 }}>
      <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={{ opacity: shown, transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 420,
          backgroundColor: online ? t.colors.good : t.colors.brand, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
        <Ionicons name={online ? 'cloud-done-outline' : 'cloud-offline-outline'} size={16} color={online ? t.colors.textInverted : t.colors.onBrand} />
        <Txt style={{ color: online ? t.colors.textInverted : t.colors.onBrand, fontSize: t.size.sm, fontWeight: t.weight.medium as never, flexShrink: 1 }}>{label}</Txt>
      </Animated.View>
    </View>
  )
}
