import { Animated, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { courierName, money, relative, type OrderSummary, type Theme } from '@trueglaz/core'
import { Txt } from './Txt'
import { GearArt, lift } from './kit'
import { FadeIn, LiveDot, Pop, statusKey, useFill, useStatusChange } from './motion'

type Line = OrderSummary['lines'][number]

const STEPS = ['Paid', 'Packed', 'Shipped', 'Delivered'] as const

/** Where one order stands, for the home card. Null when it is not "in progress". */
function progress(o: OrderSummary): { step: number; title: string; note: string; tone: 'cta' | 'good' | 'warn'; line: Line | undefined } | null {
  const line = o.lines.find((l) => !['cancelled', 'returned', 'accepted'].includes(l.state)) ?? o.lines[0]
  if (o.state === 'pending_payment') {
    return { step: -1, title: 'Waiting for payment', note: 'Pay to confirm, or it lapses and goes back on sale', tone: 'warn', line }
  }
  if (!['paid', 'dispatched', 'delivered'].includes(o.state) || !line) return null
  if (line.cancelRequest?.state === 'requested') {
    return { step: 0, title: 'Cancellation requested', note: 'We are reviewing it, usually within a working day', tone: 'warn', line }
  }
  switch (line.state) {
    case 'open': case 'packing':
      return { step: 1, title: 'Being packed', note: `Paid ${o.paidAt ? relative(o.paidAt) : ''}`.trim(), tone: 'cta', line }
    case 'dispatched': {
      const by = courierName(line.courierCode)
      return { step: 2, title: 'On its way', note: [by && `With ${by}`, line.trackingNumber && `#${line.trackingNumber}`].filter(Boolean).join(' · ') || 'With the courier', tone: 'good', line }
    }
    case 'delivered':
      return { step: 3, title: 'Delivered — check it', note: line.acceptanceWindowEndsAt ? `Raise anything ${relative(line.acceptanceWindowEndsAt).replace(/^in /, 'within ')}` : 'Tell us if anything is wrong', tone: 'good', line }
    case 'return_requested':
      return { step: 3, title: 'Return in progress', note: 'We will update you at each step', tone: 'warn', line }
    default:
      return null
  }
}

/**
 * Orders in progress, on Home (TG-110): the item, where it is on the
 * paid → packed → shipped → delivered line, and the next thing to know.
 * One order fills the width; several scroll sideways.
 */
export function OrderTracker({ t, orders, imageBySlug, onOpen, onAll }: {
  t: Theme
  orders: OrderSummary[] | null
  imageBySlug: Map<string, string | null>
  onOpen: (id: string) => void
  onAll: () => void
}) {
  const { width } = useWindowDimensions()
  const live = (orders ?? []).map((o) => ({ o, p: progress(o) })).filter((x) => x.p) as { o: OrderSummary; p: NonNullable<ReturnType<typeof progress>> }[]
  if (live.length === 0) return null
  const cardWidth = live.length === 1 ? width - t.space.x4 * 2 : Math.min(width - 72, 340)

  return (
    <View style={{ gap: 10 }}>
      <View style={{ paddingHorizontal: t.space.x4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>
          {live.length === 1 ? 'Your order' : `Your orders · ${live.length}`}
        </Txt>
        <Pressable onPress={onAll} hitSlop={8} accessibilityRole="link">
          <Txt style={{ color: t.colors.accent, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>All orders</Txt>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: 12, paddingBottom: 6 }}>
        {live.map(({ o, p }, i) => (
          <FadeIn key={o.id} index={i}>
            <TrackCard t={t} o={o} p={p} width={cardWidth} imageBySlug={imageBySlug} onOpen={onOpen} />
          </FadeIn>
        ))}
      </ScrollView>
    </View>
  )
}

/** One order on the home card: fills its progress bar, pulses while moving, and says when it changed. */
function TrackCard({ t, o, p, width, imageBySlug, onOpen }: {
  t: Theme; o: OrderSummary; p: NonNullable<ReturnType<typeof progress>>; width: number
  imageBySlug: Map<string, string | null>; onOpen: (id: string) => void
}) {
  const name = (p.line?.title ?? 'Your order').split('·')[0].trim()
  const img = p.line?.modelSlug ? imageBySlug.get(p.line.modelSlug) ?? null : null
  const toneFg = p.tone === 'good' ? t.colors.good : p.tone === 'warn' ? t.colors.warn : t.colors.cta
  const moved = useStatusChange(o.id, statusKey(o.state, o.lines[0]?.state), 'peek')
  return (
    <Pressable onPress={() => onOpen(o.id)} accessibilityRole="button"
      accessibilityLabel={`Order ${o.orderNumber}: ${name}, ${p.title}${moved.changed ? ', updated' : ''}`}
      style={[{ width, backgroundColor: t.colors.bgRaised, borderRadius: 16, padding: 14, gap: 12 }, lift(t)]}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <GearArt uri={img} width={56} height={56} radius={12} icon={24} lens={/\d+mm\b|f\/\d/i.test(name)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{name}</Txt>
          <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>Order {o.orderNumber} · {money(o.totalMinor)}</Txt>
        </View>
        {moved.changed ? <UpdatedChip t={t} /> : <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />}
      </View>

      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LiveDot color={toneFg} live={p.step < 3} />
          <Txt style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{p.title}</Txt>
        </View>
        {!!p.note && <Txt numberOfLines={1} style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{p.note}</Txt>}
      </View>

      {p.step >= 0 && (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {STEPS.map((s, i) => (
              <Segment key={s} back={t.colors.bgSunken} color={i < p.step ? t.colors.good : toneFg} on={i <= p.step} delay={200 + i * 160} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 5 }}>
            {STEPS.map((s, i) => (
              <Txt key={s} style={{ flex: 1, fontSize: 10, color: i <= p.step ? t.colors.text : t.colors.textMuted, fontWeight: (i === p.step ? t.weight.bold : t.weight.normal) as never }}>{s}</Txt>
            ))}
          </View>
        </View>
      )}
      {p.step < 0 && (
        <View style={{ alignSelf: 'flex-start', backgroundColor: t.colors.cta, borderRadius: t.radius.pill, paddingVertical: 7, paddingHorizontal: 14 }}>
          <Txt style={{ color: t.colors.onCta, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>Pay {money(o.totalMinor)}</Txt>
        </View>
      )}
    </Pressable>
  )
}

/** One piece of the Paid > Packed > Shipped > Delivered bar, filling left to right in turn. */
function Segment({ back, color, on, delay }: { back: string; color: string; on: boolean; delay: number }) {
  const fill = useFill(delay, 320)
  return (
    <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: back, overflow: 'hidden' }}>
      {on && <Animated.View style={{ height: 5, borderRadius: 3, backgroundColor: color, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />}
    </View>
  )
}

export function UpdatedChip({ t }: { t: Theme }) {
  return (
    <Pop delay={500}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.colors.accentSoft, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 9 }}>
        <Ionicons name="sparkles" size={11} color={t.colors.accent} />
        <Txt style={{ color: t.colors.accent, fontSize: 11, fontWeight: t.weight.bold as never }}>Updated</Txt>
      </View>
    </Pop>
  )
}
