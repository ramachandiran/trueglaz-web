import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { api, dateTime, orderEventTitle, orderEventTone, useApi, type ReturnForBuyer } from '@trueglaz/core'
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
 * A return's status and the line's full history, for the buyer (TG-91, TG-92).
 * Shown whenever a return exists, including after the sale has closed, so a
 * decline and its reason never disappear from the order.
 */
export function LineReturnAndHistory({ lineId, state, acceptedBy }: { lineId: string; state: string; acceptedBy: string | null }) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const hasCase = ['return_requested', 'returned'].includes(state) || acceptedBy === 'return_declined' || acceptedBy === 'return_refused'
  const rc = useApi(() => (hasCase ? api.returnForLine(lineId) : Promise.resolve(null)), [lineId, state])
  const history = useApi(() => (open ? api.lineHistory(lineId) : Promise.resolve(null)), [lineId, open, state])
  const tone = { good: t.colors.good, bad: t.colors.bad, warn: t.colors.cta, plain: t.colors.textMuted }
  const r = rc.data
  const bad = r?.case.state === 'declined' || r?.case.state === 'sale_stands'

  return (
    <View style={{ gap: t.space.x2 }}>
      {r && (
        <View style={{ backgroundColor: bad ? t.colors.badSoft : t.colors.accentSoft, borderRadius: 10, padding: t.space.x3 }}>
          <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>
            <Txt style={{ fontWeight: t.weight.bold as never }}>Return: </Txt>{RETURN_TEXT(r)}
          </Txt>
        </View>
      )}
      {(
        <Pressable onPress={() => setOpen(!open)} hitSlop={6}>
          <Txt style={{ color: t.colors.accent, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{open ? 'Hide history' : 'History'}</Txt>
        </Pressable>
      )}
      {open && (history.loading && !history.data ? <Muted size={t.size.xs}>Loading…</Muted> : (
        <View style={{ gap: t.space.x2, paddingLeft: 2 }}>
          {(history.data ?? []).map((e, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: tone[orderEventTone(e.kind)] }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{orderEventTitle(e)}</Txt>
                <Muted size={t.size.xs}>{dateTime(e.at)}</Muted>
                {e.note && <Txt style={{ color: t.colors.text, fontSize: t.size.xs }}>“{e.note}”</Txt>}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}
