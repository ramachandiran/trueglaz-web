import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, useApi } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Pill } from '../components/kit'
import { PushPrompt } from '../components/PushPrompt'

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

  const spark = (top: number, left: number, w: number, h: number, c: string, r: number) => (
    <View style={{ position: 'absolute', top, left, width: w, height: h, borderRadius: 3, backgroundColor: c, transform: [{ rotate: `${r}deg` }] }} />
  )

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + t.space.x4, paddingHorizontal: t.space.x4 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 190, height: 160 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={{ position: 'absolute', left: 26, top: 26, transform: [{ rotate: '-12deg' }] }}>
            <Ionicons name="bag-handle" size={96} color={t.colors.brandAccent} />
          </View>
          <View style={{ position: 'absolute', left: 92, top: 56, transform: [{ rotate: '10deg' }] }}>
            <Ionicons name="camera" size={72} color={t.colors.cta} />
          </View>
          {spark(6, 14, 6, 6, t.colors.brandAccent, 0)}
          {spark(0, 150, 6, 13, t.colors.cta, 40)}
          {spark(122, 4, 6, 6, t.colors.cta, 0)}
          {spark(116, 168, 6, 13, t.colors.brandAccent, -30)}
          {spark(44, 176, 6, 6, t.colors.brandAccent, 0)}
        </View>
        <Txt accessibilityRole="header" style={{ color: t.colors.text, fontSize: 34, fontWeight: t.weight.bold as never, letterSpacing: -0.8, marginTop: t.space.x5 }}>
          Success!
        </Txt>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.md, lineHeight: 22, textAlign: 'center', marginTop: t.space.x3, maxWidth: 300 }}>
          Your {item} is yours. We pack it within a day, and your tax invoice is already in your inbox.
        </Txt>
      </View>
      <View style={{ gap: t.space.x3 }}>
        <PushPrompt reason="We'll tell you when it's packed, shipped and delivered." />
        <Pill block label="Track this order" onPress={() => navigation.replace('OrderDetail', { id: orderId, justPaid: true })} />
        <Pill block variant="ghost" label="Continue shopping" onPress={() => navigation.navigate('Tabs', { screen: 'Shop' })} />
      </View>
    </View>
  )
}
