import { useEffect } from 'react'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, dateOnly, money, useApi } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Card, Empty, ErrorNote, Loading, Muted, StateBadge } from '../components/ui'

export function OrdersScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi(() => api.myOrders(), [])

  useEffect(() => navigation.addListener('focus', reload), [navigation, reload])

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <View style={{ padding: t.space.x4 }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>Your orders</Txt>
      </View>

      {loading && !data && <Loading />}
      {error && <View style={{ padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>}

      {data && (
        <FlatList
          data={data}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: t.space.x4, gap: t.space.x3 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={t.colors.accent} />}
          ListEmptyComponent={<Empty title="No orders yet" hint="Anything you buy shows up here." />}
          renderItem={({ item: o }) => (
            <Pressable onPress={() => navigation.navigate('OrderDetail', { id: o.id })}>
              <Card style={{ gap: t.space.x2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt style={{ color: t.colors.text, fontFamily: t.font.mono, fontWeight: t.weight.medium as never }}>{o.orderNumber}</Txt>
                  <StateBadge state={o.state} />
                </View>
                {o.lines.map((l) => (<Txt key={l.id} style={{ color: t.colors.text }}>{l.title}</Txt>))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Muted size={t.size.xs}>{dateOnly(o.createdAt)}</Muted>
                  <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{money(o.totalMinor)}</Txt>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}
