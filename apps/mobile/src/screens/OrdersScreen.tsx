import { useEffect, useMemo, useState } from 'react'
import { FlatList, RefreshControl, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, dateOnly, money, useApi, type OrderSummary, type Theme } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Empty, ErrorNote, Loading } from '../components/ui'
import { sizedUri } from '../components/ModelImage'
import { Chip, ChipRow, GearArt, PageTitle, Pill, Surface } from '../components/kit'
import { FadeIn, LiveDot, statusKey, useStatusChange } from '../components/motion'
import { UpdatedChip } from '../components/OrderTracker'

/** States where something is still happening, so the status dot breathes. */
const MOVING = ['pending_payment', 'paid', 'dispatched', 'delivered']

/** The three tabs an order can sit under, by its state. */
const TABS = [
  { key: 'live', label: 'On the way', states: ['pending_payment', 'paid', 'dispatched', 'delivered'] },
  { key: 'done', label: 'Completed', states: ['completed'] },
  { key: 'closed', label: 'Cancelled & returns', states: ['cancelled', 'refunded', 'returned'] },
] as const
type TabKey = (typeof TABS)[number]['key']

/** What an order's state means to the buyer, and its colour. */
function statusOf(t: Theme, state: string): [string, string] {
  switch (state) {
    case 'pending_payment': return ['Awaiting payment', t.colors.warn]
    case 'paid': return ['Packing', t.colors.cta]
    case 'dispatched': return ['Shipped', t.colors.good]
    case 'delivered': return ['Delivered · check it', t.colors.good]
    case 'completed': return ['Yours', t.colors.good]
    case 'cancelled': return ['Cancelled', t.colors.bad]
    case 'refunded': case 'returned': return ['Refunded', t.colors.textMuted]
    default: return [state.replace(/_/g, ' '), t.colors.textMuted]
  }
}

function lineStatus(t: Theme, l: OrderSummary['lines'][number]): [string, string] {
  if (l.cancelRequest?.state === 'requested') return ['Cancellation requested', t.colors.warn]
  switch (l.state) {
    case 'dispatched': return ['Shipped', t.colors.good]
    case 'delivered': return ['Delivered · check it', t.colors.good]
    case 'return_requested': return ['Return in progress', t.colors.warn]
    case 'accepted': return ['Yours', t.colors.good]
    case 'cancelled': return ['Cancelled', t.colors.bad]
    case 'returned': return ['Refunded', t.colors.textMuted]
    default: return ['Packing', t.colors.cta]
  }
}

/** Orders, in the 2026 layout: a big title, status tabs, and one card per order. */
export function OrdersScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi(() => api.myOrders(), [])
  const images = useApi(() => api.modelImages(), [])
  const imageBySlug = useMemo(
    () => new Map((images.data?.models ?? []).map((m) => [m.slug, sizedUri(m.image, 200)])),
    [images.data],
  )
  const [tab, setTab] = useState<TabKey>('live')

  useEffect(() => navigation.addListener('focus', reload), [navigation, reload])

  const inTab = (key: TabKey, o: OrderSummary) => (TABS.find((x) => x.key === key)!.states as readonly string[]).includes(o.state)
  const count = (key: TabKey) => (data ?? []).filter((o) => inTab(key, o)).length
  const shown = (data ?? []).filter((o) => inTab(tab, o))

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <PageTitle title="My Orders" back={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
      <View style={{ marginTop: t.space.x3 }}>
        <ChipRow>
          {TABS.map((x) => {
            const n = count(x.key)
            return <Chip key={x.key} label={n ? `${x.label} · ${n}` : x.label} on={tab === x.key} onPress={() => setTab(x.key)} />
          })}
        </ChipRow>
      </View>

      {loading && !data && <Loading />}
      {error && <View style={{ padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>}

      {data && (
        <FlatList
          data={shown}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: t.space.x4, gap: 14, paddingBottom: t.space.x6 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={t.colors.accent} />}
          ListEmptyComponent={<Empty title={tab === 'live' ? 'Nothing on the way' : 'Nothing here yet'} hint="Anything you buy shows up here." />}
          renderItem={({ item: o, index }) => (
            <FadeIn index={index} key={`${tab}-${o.id}`}>
              <OrderCard t={t} o={o}
                img={o.lines[0]?.modelSlug ? imageBySlug.get(o.lines[0].modelSlug) : undefined}
                onOpen={() => navigation.navigate('OrderDetail', { id: o.id })} />
            </FadeIn>
          )}
        />
      )}
    </View>
  )
}

function OrderCard({ t, o, img, onOpen }: { t: Theme; o: OrderSummary; img?: string; onOpen: () => void }) {
  const first = o.lines[0]
  const extra = o.lines.length - 1
  // A paid order's own state stays "paid" while its item travels, so the card
  // reads the item: shipped, delivered, a return or a cancellation in progress.
  const [status, colour] = o.state === 'paid' && first ? lineStatus(t, first) : statusOf(t, o.state)
  const name = first ? first.title.split('·')[0].trim() : 'Order'
  const moved = useStatusChange(o.id, statusKey(o.state, first?.state), 'peek')
  const moving = MOVING.includes(o.state) && first?.state !== 'delivered'
  return (
    <Surface style={{ padding: t.space.x4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>Order {o.orderNumber}</Txt>
        {moved.changed ? <UpdatedChip t={t} /> : <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{dateOnly(o.createdAt)}</Txt>}
      </View>
      <View style={{ flexDirection: 'row', gap: t.space.x3, marginTop: t.space.x3, alignItems: 'center' }}>
        <GearArt uri={img} width={54} height={54} radius={10} icon={24} lens={/\d+mm\b|f\/\d/i.test(name)} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.medium as never }}>
            {name}{extra > 0 ? `  +${extra} more` : ''}
          </Txt>
          {first && (
            <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>
              Grade {first.gradeCodeAtSale}{o.invoiceNumber ? ` · Invoice ${o.invoiceNumber}` : ''}
            </Txt>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.space.x4, gap: t.space.x2 }}>
        <Pill label="Details" variant="ghost" small onPress={onOpen} />
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm }}>
          Total: <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{money(o.totalMinor)}</Txt>
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <LiveDot color={colour} live={moving} />
          <Txt style={{ color: colour, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{status}</Txt>
        </View>
      </View>
    </Surface>
  )
}
