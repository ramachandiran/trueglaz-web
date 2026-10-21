import { ScrollView, View, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, isSeller, money, useApi, useSession } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Badge, Card, Muted, SectionTitle } from '../components/ui'
import { Button } from '../components/form'

export function HomeScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const fresh = useApi(() => api.listings({ size: 6 }), [])
  const sold = useApi(() => api.recentlySold(6), [])
  const firstName = session?.displayName?.split(' ')[0] ?? 'there'

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + t.space.x3, padding: t.space.x4, gap: t.space.x5, paddingBottom: t.space.x7 }}>
      <View style={{ gap: 2 }}>
        <Muted>Welcome back</Muted>
        <Txt style={{ color: t.colors.text, fontSize: t.size.xxl, fontWeight: t.weight.bold as never }}>{firstName}</Txt>
      </View>

      <Card style={{ gap: t.space.x3, backgroundColor: t.colors.brand, borderColor: t.colors.brand }}>
        <Txt style={{ color: t.colors.onBrand, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Inspected used gear, graded and guaranteed</Txt>
        <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm }}>Every item is checked and graded by TrueGlaz before it's listed.</Txt>
        <Button label="Browse the shop" variant="cta" onPress={() => navigation.navigate('Shop')} />
      </Card>

      <View style={{ gap: t.space.x3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle>Fresh listings</SectionTitle>
          <Pressable onPress={() => navigation.navigate('Shop')}><Txt style={{ color: t.colors.accent }}>See all →</Txt></Pressable>
        </View>
        {(fresh.data?.content ?? []).map((l) => (
          <Pressable key={l.id} onPress={() => navigation.navigate('Listing', { id: l.id })}>
            <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: 2, paddingRight: t.space.x3 }}>
                <Txt style={{ color: t.colors.text, fontWeight: t.weight.medium as never }}>{l.title.split('·')[0].trim()}</Txt>
                <Badge label={l.gradeCode} tone="accent" />
              </View>
              <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{money(l.priceMinor, l.currency)}</Txt>
            </Card>
          </Pressable>
        ))}
        {fresh.data && fresh.data.content.length === 0 && <Muted>Nothing listed just now.</Muted>}
      </View>

      {sold.data && sold.data.length > 0 && (
        <View style={{ gap: t.space.x3 }}>
          <SectionTitle>Recently sold</SectionTitle>
          {sold.data.map((s) => (
            <Card key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt style={{ color: t.colors.text }}>{s.title.split('·')[0].trim()}</Txt>
              <Muted size={t.size.xs}>{money(s.priceMinor)}</Muted>
            </Card>
          ))}
        </View>
      )}

      <Card style={{ gap: t.space.x2 }}>
        <SectionTitle>{isSeller(session) ? 'Selling with TrueGlaz' : 'Got gear to sell?'}</SectionTitle>
        <Muted>
          {isSeller(session)
            ? 'Track your consignments, prices and payouts.'
            : 'Consign your camera or lens — we inspect, grade, list and pay you when it sells.'}
        </Muted>
        <Button label={isSeller(session) ? 'Open my selling' : 'Start selling'} variant="ghost" onPress={() => navigation.navigate('Sell')} />
      </Card>
    </ScrollView>
  )
}
