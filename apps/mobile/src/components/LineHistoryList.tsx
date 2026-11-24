import { useState } from 'react'
import { Pressable, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, dateTime, orderEventTitle, orderEventTone, useApi, type OrderLineEvent, type ReturnForBuyer } from '@trueglaz/core'
import { Txt } from './Txt'
import { Muted } from './ui'
import { useTheme } from '../theme/ThemeContext'

const RETURN_TEXT = (r: ReturnForBuyer): string => {
  const c = r.case
  switch (c.state) {
    case 'requested': return 'Requested — we’re reviewing your unboxing video and will reply within a working day.'
    case 'approved': if (c.reasonCode === 'cancelled_in_transit') return 'Cancellation approved — the courier is bringing it back to us. We refund you once it is back and checked.'
      return `Approved. Send it back with ${r.courierCode ?? 'the courier'}${r.trackingNumber ? `, tracking ${r.trackingNumber}` : ''}. We refund you once it has arrived and been checked.`
    case 'received': return 'We have your parcel and are checking it.'
    case 'inspected': return 'Checked. We are finishing up.'
    case 'refunded': return 'Return accepted. Your refund is being processed.'
    case 'escalated': return 'It did not pass our check on arrival. A senior member of our team is reviewing it and will contact you.'
    case 'sale_stands': return 'After review the sale stands; the item is being sent back to you.'
    case 'declined': return `Declined — ${(c.decisionNote ?? 'see the history').replace(/[.\s]+$/, '')}. The sale has closed as delivered.`
    default: return c.state
  }
}

/**
 * Where a return stands, in words, for the buyer (TG-91). Shown whenever a
 * return exists, including after the sale has closed, so a decline and its
 * reason never disappear from the order.
 */
export function LineReturnNote({ lineId, state, acceptedBy }: { lineId: string; state: string; acceptedBy: string | null }) {
  const t = useTheme()
  const hasCase = ['return_requested', 'returned'].includes(state) || acceptedBy === 'return_declined' || acceptedBy === 'return_refused'
  const rc = useApi(() => (hasCase ? api.returnForLine(lineId) : Promise.resolve(null)), [lineId, state])
  const r = rc.data
  if (!r) return null
  const bad = r.case.state === 'declined' || r.case.state === 'sale_stands'
  return (
    <View style={{ backgroundColor: bad ? t.colors.badSoft : t.colors.accentSoft, borderRadius: 10, padding: t.space.x3 }}>
      <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>
        <Txt style={{ fontWeight: t.weight.bold as never }}>Return: </Txt>{RETURN_TEXT(r)}
      </Txt>
    </View>
  )
}

type IconName = React.ComponentProps<typeof Ionicons>['name']

/** One entry on the order's history, from any of its lines (or the order itself). */
export interface HistoryEntry { at: string; title: string; note?: string | null; kind: string; what?: string }

const ICON: Record<string, IconName> = {
  placed: 'receipt-outline', paid: 'card-outline', dispatched: 'car-outline', tracking_updated: 'navigate-outline',
  delivered: 'cube-outline', closed: 'checkmark-done-outline', refunded: 'cash-outline',
  return_requested: 'return-down-back-outline', return_approved: 'return-down-back-outline', return_received: 'archive-outline',
  return_checked: 'search-outline', return_refunded: 'cash-outline', return_declined: 'close-circle-outline',
  return_escalated: 'alert-circle-outline', return_sale_stands: 'arrow-redo-outline',
  cancel_requested: 'hand-left-outline', cancel_withdrawn: 'arrow-undo-outline', cancel_approved: 'close-circle-outline', cancel_declined: 'play-forward-outline',
}

/** Turns line events into history entries, with the order's own "placed" as the first. */
export function historyEntries(placedAt: string, perLine: { what?: string; events: OrderLineEvent[] }[]): HistoryEntry[] {
  const all: HistoryEntry[] = [{ at: placedAt, title: 'Order placed', kind: 'placed' }]
  for (const l of perLine) for (const e of l.events) all.push({ at: e.at, title: orderEventTitle(e), note: e.note, kind: e.kind, what: l.what })
  return all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

const SHOWN = 4

/**
 * The order's history (TG-182): its own section, newest first, as a timeline.
 * The latest entry is marked as the current one; long histories show the
 * newest few with Show all.
 */
export function OrderHistory({ entries, loading }: { entries: HistoryEntry[]; loading?: boolean }) {
  const t = useTheme()
  const [all, setAll] = useState(false)
  const tone = { good: t.colors.good, bad: t.colors.bad, warn: t.colors.cta, plain: t.colors.textMuted }
  const shown = all ? entries : entries.slice(0, SHOWN)
  return (
    <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 16, padding: t.space.x4, gap: t.space.x3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt accessibilityRole="header" style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.6 }}>HISTORY</Txt>
        {entries.length > 0 && <Muted size={t.size.xs}>{entries.length} {entries.length === 1 ? 'update' : 'updates'}</Muted>}
      </View>
      {loading && entries.length <= 1 ? <Muted size={t.size.xs}>Loading…</Muted> : (
        <View>
          {shown.map((e, i) => {
            const latest = i === 0
            const last = i === shown.length - 1
            const tn = e.kind === 'placed' ? 'plain' : orderEventTone(e.kind)
            const c = tone[tn]
            // The latest entry is filled; its icon colour is chosen per fill so it stays readable.
            const fill = { good: [t.colors.good, t.colors.onBad], bad: [t.colors.bad, t.colors.onBad], warn: [t.colors.cta, t.colors.onCta], plain: [t.colors.accent, t.colors.onAccent] }[tn]
            return (
              <View key={`${e.at}-${e.kind}-${i}`} accessible accessibilityLabel={`${e.title}, ${dateTime(e.at)}${e.note ? `. ${e.note}` : ''}`}
                style={{ flexDirection: 'row', gap: t.space.x3 }}>
                {/* The marker, and the line down to the next one. */}
                <View style={{ alignItems: 'center', width: 32 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: latest ? fill[0] : t.colors.bgSunken, borderWidth: latest ? 0 : 1, borderColor: t.colors.border }}>
                    <Ionicons name={ICON[e.kind] ?? 'ellipse-outline'} size={16} color={latest ? fill[1] : c} />
                  </View>
                  {!last && <View style={{ flex: 1, width: 2, backgroundColor: t.colors.border, marginVertical: 2 }} />}
                </View>
                <View style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : t.space.x4, paddingTop: 5, gap: 2 }}>
                  <Txt style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: (latest ? t.weight.bold : t.weight.medium) as never }}>{e.title}</Txt>
                  <Muted size={t.size.xs}>{dateTime(e.at)}{e.what ? ` · ${e.what}` : ''}</Muted>
                  {e.note ? (
                    <View style={{ marginTop: 4, backgroundColor: t.colors.bgSunken, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' }}>
                      <Txt style={{ color: t.colors.text, fontSize: t.size.xs }}>“{e.note}”</Txt>
                    </View>
                  ) : null}
                </View>
              </View>
            )
          })}
        </View>
      )}
      {entries.length > SHOWN && (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: all }} onPress={() => setAll(!all)} hitSlop={10}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Txt style={{ color: t.colors.accentText, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>
            {all ? 'Show less' : `Show all ${entries.length}`}
          </Txt>
          <Ionicons name={all ? 'chevron-up' : 'chevron-down'} size={14} color={t.colors.accentText} />
        </Pressable>
      )}
    </View>
  )
}
