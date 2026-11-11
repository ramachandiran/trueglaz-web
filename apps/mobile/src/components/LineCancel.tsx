import { useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { api, dateOnly, money, useApi } from '@trueglaz/core'
import { Txt } from './Txt'
import { Button, Field } from './form'
import { Muted } from './ui'
import { useTheme } from '../theme/ThemeContext'

const CANCELLABLE = ['open', 'packing', 'dispatched']

/**
 * Calling off a paid order before it arrives, from the phone (TG-93).
 * The buyer asks with a reason; our team decides. The status stays on the
 * order after the decision, with the refund reference when there is one.
 */
export function LineCancel({ lineId, state, totalMinor, onChanged }: { lineId: string; state: string; totalMinor: number; onChanged: () => void }) {
  const t = useTheme()
  const relevant = CANCELLABLE.includes(state) || state === 'cancelled'
  const cr = useApi(() => (relevant ? api.cancelRequestFor(lineId) : Promise.resolve(null)), [lineId, state])
  const reasons = useApi(() => (relevant ? api.cancelReasons() : Promise.resolve([])), [relevant])
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!relevant) return null
  const r = cr.data

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError(null)
    try { await fn(); setOpen(false); setNote(''); setReason(null); cr.reload(); onChanged() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const box = (children: React.ReactNode, bad = false) => (
    <View style={{ backgroundColor: bad ? t.colors.badSoft : t.colors.accentSoft, borderRadius: 10, padding: t.space.x3, gap: 6 }}>{children}</View>
  )

  if (r?.state === 'approved' && r.outcome === 'pre_dispatch') {
    return box(
      <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>
        <Txt style={{ fontWeight: t.weight.bold as never }}>Cancelled at your request</Txt> on {dateOnly(r.decidedAt)}.{' '}
        {r.refundRef ? `Your refund of ${money(totalMinor)} has been sent to how you paid (ref ${r.refundRef}). It can take 5–7 working days to show.`
          : `Your refund of ${money(totalMinor)} is being processed to how you paid.`}
      </Txt>,
    )
  }
  if (!CANCELLABLE.includes(state)) return null

  if (r?.state === 'requested') {
    return box(
      <>
        <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>
          <Txt style={{ fontWeight: t.weight.bold as never }}>Cancellation requested. </Txt>
          {state === 'dispatched' ? 'It is already with the courier, so if we approve, it comes back to us first.' : 'We hold dispatch while we review it.'}
        </Txt>
        {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.xs }}>{error}</Txt>}
        <Pressable onPress={() => run(() => api.withdrawCancel(lineId))} disabled={busy} hitSlop={6}>
          <Txt style={{ color: t.colors.accent, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{busy ? 'Withdrawing…' : 'Withdraw the request'}</Txt>
        </Pressable>
      </>,
    )
  }

  return (
    <View style={{ gap: t.space.x2 }}>
      {r?.state === 'declined' && box(
        <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>
          <Txt style={{ fontWeight: t.weight.bold as never }}>We couldn’t cancel this: </Txt>{r.decisionNote}
        </Txt>, true,
      )}
      <Button label={state === 'dispatched' ? 'Cancel — it’s on its way' : 'Cancel order'} variant="ghost" onPress={() => { setOpen(true); setError(null) }} />
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ backgroundColor: t.colors.bgRaised, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg, padding: t.space.x4, gap: t.space.x3 }}>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Cancel this order?</Txt>
            <Muted size={t.size.xs}>
              {state === 'dispatched'
                ? 'It is already with the courier. If we approve, it comes back to us and we refund you once it is back and checked.'
                : 'We hold dispatch while we review it, usually within a working day. If we approve, you are refunded in full.'}
            </Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
              {(reasons.data ?? []).map((x) => {
                const on = reason === x.code
                return (
                  <Pressable key={x.code} onPress={() => setReason(x.code)}
                    style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: on ? t.colors.accentSoft : t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }}>
                    <Txt style={{ color: on ? t.colors.accent : t.colors.text, fontSize: t.size.sm }}>{x.label}</Txt>
                  </Pressable>
                )
              })}
            </View>
            <Field label={reason === 'other' ? 'Tell us briefly why' : 'Anything else? (optional)'} value={note} onChangeText={setNote} multiline />
            {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
            <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
              <Button label="Keep the order" variant="ghost" onPress={() => setOpen(false)} style={{ flex: 1 }} />
              <Button label="Request cancellation" variant="danger" loading={busy}
                disabled={!reason || (reason === 'other' && note.trim().length < 5)}
                onPress={() => reason && run(() => api.requestCancel(lineId, reason, note))} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}
