import { useEffect, useMemo } from 'react'
import { FlatList, Image, Pressable, RefreshControl, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, dateOnly, money, useApi, type OrderSummary, type Theme } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Empty, ErrorNote, Loading, stateTone } from '../components/ui'
import { API_ORIGIN } from '../config'

export function OrdersScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi(() => api.myOrders(), [])
  const images = useApi(() => api.modelImages(), [])
  const imageBySlug = useMemo(
    () => new Map((images.data?.models ?? []).map((m) => [m.slug, API_ORIGIN + m.image.url])),
    [images.data],
  )

  useEffect(() => navigation.addListener('focus', reload), [navigation, reload])

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: t.space.x4, paddingTop: t.space.x2 }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never, letterSpacing: -0.5 }}>Your orders</Txt>
        {data && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm, marginTop: 2 }}>{data.length} order{data.length === 1 ? '' : 's'}</Txt>}
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
          renderItem={({ item: o }) => {
            const first = o.lines[0]
            const img = first?.modelSlug ? imageBySlug.get(first.modelSlug) : undefined
            const extra = o.lines.length - 1
            return (
              <Pressable onPress={() => navigation.navigate('OrderDetail', { id: o.id })}
                style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 18, padding: t.space.x4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt style={{ color: t.colors.textMuted, fontFamily: t.font.mono, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{o.orderNumber}</Txt>
                  <StatusPill t={t} state={o.state} />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3, marginTop: t.space.x3 }}>
                  <View style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: t.colors.bgSunken, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {img
                      ? <Image source={{ uri: img }} style={{ width: 46, height: 46 }} resizeMode="cover" />
                      : <Ionicons name="camera-outline" size={22} color={t.colors.brand} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>
                      {first ? first.title.split('·')[0].trim() : 'Order'}{extra > 0 ? `  +${extra} more` : ''}
                    </Txt>
                    {first && (first.gradeLabel || first.categoryName) && (
                      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, marginTop: 2 }}>{first.gradeLabel ?? first.categoryName}</Txt>
                    )}
                  </View>
                  {first && (
                    <View style={{ backgroundColor: t.colors.goodSoft, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8 }}>
                      <Txt style={{ color: t.colors.good, fontSize: 10.5, fontWeight: t.weight.bold as never }}>{first.gradeCodeAtSale}</Txt>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: t.space.x3, paddingTop: t.space.x3, borderTopWidth: 1, borderTopColor: t.colors.border }}>
                  <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{dateOnly(o.createdAt)}</Txt>
                  <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never, letterSpacing: -0.3 }}>{money(o.totalMinor)}</Txt>
                </View>
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}

function StatusPill({ t, state }: { t: Theme; state: string }) {
  const tone = stateTone(state)
  const c = {
    good: { fg: t.colors.good, bg: t.colors.goodSoft },
    warn: { fg: t.colors.warn, bg: t.colors.warnSoft },
    bad: { fg: t.colors.bad, bg: t.colors.badSoft },
    accent: { fg: t.colors.accentHover, bg: t.colors.accentSoft },
    neutral: { fg: t.colors.textMuted, bg: t.colors.bgSunken },
  }[tone]
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: t.radius.pill, paddingVertical: 4, paddingHorizontal: 11 }}>
      <Txt style={{ color: c.fg, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>{state.replace(/_/g, ' ')}</Txt>
    </View>
  )
}
