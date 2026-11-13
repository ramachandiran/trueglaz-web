import { useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, useApi } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Pill } from '../components/kit'
import { PushPrompt } from '../components/PushPrompt'
import { FadeIn, NATIVE, useReducedMotion } from '../components/motion'

/**
 * The celebration (TG-120): the bag drops in, the camera lands on it a beat
 * later, and the sparks burst out from the middle. About 0.8 s, once.
 */
function useDrop(delay: number) {
  const reduced = useReducedMotion()
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduced) { v.setValue(1); return }
    const a = Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, friction: 6, tension: 90, useNativeDriver: NATIVE })])
    a.start()
    return () => a.stop()
  }, [reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  return v
}

/**
 * The moment after paying: one clear "it worked", what happens next, and the
 * two places to go. The order itself (and its invoice) is one tap away.
 */
export function OrderPlacedScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const orderId: string = route.params.orderId
  const order = useApi(() => api.order(orderId), [orderId])
  const first = order.data?.lines?.[0]
  const item = first?.title ? first.title.split('·')[0].trim() : 'gear'

  const bag = useDrop(80)
  const cam = useDrop(260)
  const burst = useDrop(420)
  const drop = (v: Animated.Value, rot: string, from: number) => ({
    opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
      { rotate: rot },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
    ],
  })
  // Each spark starts at the middle of the picture and flies out to its place.
  const spark = (top: number, left: number, w: number, h: number, c: string, r: number) => (
    <Animated.View key={`${top}-${left}`} style={{
      position: 'absolute', top, left, width: w, height: h, borderRadius: 3, backgroundColor: c,
      opacity: burst,
      transform: [
        { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [95 - left, 0] }) },
        { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [80 - top, 0] }) },
        { rotate: `${r}deg` },
        { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
      ],
    }} />
  )

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + t.space.x4, paddingHorizontal: t.space.x4 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 190, height: 160 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[{ position: 'absolute', left: 26, top: 26 }, drop(bag, '-12deg', -70)]}>
            <Ionicons name="bag-handle" size={96} color={t.colors.brandAccent} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', left: 92, top: 56 }, drop(cam, '10deg', -110)]}>
            <Ionicons name="camera" size={72} color={t.colors.cta} />
          </Animated.View>
          {spark(6, 14, 6, 6, t.colors.brandAccent, 0)}
          {spark(0, 150, 6, 13, t.colors.cta, 40)}
          {spark(122, 4, 6, 6, t.colors.cta, 0)}
          {spark(116, 168, 6, 13, t.colors.brandAccent, -30)}
          {spark(44, 176, 6, 6, t.colors.brandAccent, 0)}
        </View>
        <FadeIn delay={450} style={{ alignItems: 'center' }}>
        <Txt accessibilityRole="header" style={{ color: t.colors.text, fontSize: 34, fontWeight: t.weight.bold as never, letterSpacing: -0.8, marginTop: t.space.x5 }}>
          Success!
        </Txt>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.md, lineHeight: 22, textAlign: 'center', marginTop: t.space.x3, maxWidth: 300 }}>
          Your {item} is yours. We pack it within a day, and your tax invoice is already in your inbox.
        </Txt>
        </FadeIn>
      </View>
      <FadeIn delay={650} style={{ gap: t.space.x3 }}>
        <PushPrompt reason="We'll tell you when it's packed, shipped and delivered." />
        <Pill block label="Track this order" onPress={() => navigation.replace('OrderDetail', { id: orderId, justPaid: true })} />
        <Pill block variant="ghost" label="Continue shopping" onPress={() => navigation.navigate('Tabs', { screen: 'Shop' })} />
      </FadeIn>
    </View>
  )
}
