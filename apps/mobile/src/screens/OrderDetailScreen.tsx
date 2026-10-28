import { useState } from 'react'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, dateTime, money, useApi, type OrderLine } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Card, ErrorNote, Loading, Muted, SectionTitle, StateBadge, stateTone } from '../components/ui'
import { type TrackStep } from '../components/StatusTracker'
import { ProgressSection, StatusHero } from '../components/StatusViews'

/** Once a buyer owns a unit, one tap files it in their Gear Vault, pre-filled. */
const OWNED_STATES = ['delivered', 'accepted']
function VaultAdd({ lineId, state }: { lineId: string; state: string }) {
  const t = useTheme()
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle')
  if (!OWNED_STATES.includes(state)) return null
  if (status === 'added') {
    return (
      <View style={{ marginTop: t.space.x2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: t.colors.goodSoft, borderRadius: 12, paddingVertical: 11 }}>
        <Ionicons name="checkmark-circle" size={16} color={t.colors.good} />
        <Txt style={{ color: t.colors.good, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>In your Gear Vault</Txt>
      </View>
    )
  }
  async function add() {
    setStatus('adding')
    try { await api.addGearFromOrderLine(lineId); setStatus('added') } catch { setStatus('error') }
  }
  return (
    <Pressable onPress={add} disabled={status === 'adding'}
      style={{ marginTop: t.space.x2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.colors.accent, borderRadius: 12, paddingVertical: 10, opacity: status === 'adding' ? 0.6 : 1 }}>
      <Ionicons name={status === 'error' ? 'refresh' : 'shield-outline'} size={16} color={t.colors.accent} />
      <Txt style={{ color: t.colors.accent, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>
        {status === 'adding' ? 'Adding…' : status === 'error' ? 'Try again' : 'Add to my Gear Vault'}
      </Txt>
    </Pressable>
  )
}

/** A one-line summary of where a buyer's order line stands, for the status hero. */
const ORDER_BLURB: Record<string, string> = {
  open: 'Your payment is confirmed and we are getting it ready.',
  packing: 'We are preparing your item for dispatch.',
  dispatched: 'On its way to you.',
  delivered: 'Delivered — accept it to finalise the sale.',
  accepted: 'Sale finalised. Enjoy your gear!',
  cancelled: 'This order was cancelled.',
  return_requested: "We'll be in touch about your return.",
  returned: 'This item was returned to TrueGlaz.',
}

/** The buyer-facing order journey, derived from the line's fulfilment state. */
function orderSteps(orderState: string, line: OrderLine | undefined): TrackStep[] {
  const s = line?.state ?? 'open'
  if (orderState === 'cancelled' || s === 'cancelled') {
    return [
      { title: 'Order placed', state: 'done' },
      { title: 'Cancelled', desc: 'This order was cancelled.', state: 'cancelled', meta: 'Cancelled' },
    ]
  }
  if (s === 'return_requested' || s === 'returned') {
    return [
      { title: 'Order placed', state: 'done' },
      { title: 'Delivered', state: 'done' },
      s === 'returned'
        ? { title: 'Returned', desc: 'Item returned to TrueGlaz.', state: 'done', tone: 'bad', meta: 'Returned' }
        : { title: 'Return requested', desc: "We'll be in touch about your return.", state: 'current', tone: 'bad', meta: 'In progress' },
    ]
  }
  const order = ['open', 'packing', 'dispatched', 'delivered', 'accepted']
  const stage = Math.max(0, order.indexOf(s)) + 1 // +1 for the always-done "placed" step
  const defs = [
    { title: 'Order placed', desc: undefined as string | undefined },
    { title: 'Payment confirmed', desc: undefined },
    { title: 'Preparing to ship', desc: undefined },
    { title: 'On the way', desc: undefined },
    { title: 'Delivered', desc: line?.acceptanceWindowEndsAt ? `Accept by ${dateTime(line.acceptanceWindowEndsAt)}` : undefined },
    { title: 'Completed', desc: 'Sale finalised.' },
  ]
  return defs.map((d, i): TrackStep => {
    const state: TrackStep['state'] = i < stage ? 'done' : i === stage ? 'current' : 'upcoming'
    return { title: d.title, desc: d.desc, state, meta: state === 'current' ? 'In progress' : i === 5 && state === 'done' ? 'Completed' : undefined }
  })
}

export function OrderDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const id: string = route.params.id
  const justPaid: boolean = !!route.params?.justPaid
  const awaitingPayment: boolean = !!route.params?.awaitingPayment

  const { data, error, loading, reload } = useApi(() => api.order(id), [id])
  const reasons = useApi(() => api.reasonCodes('return'), [])

  const [busyLine, setBusyLine] = useState<string | null>(null)
  const [returnFor, setReturnFor] = useState<OrderLine | null>(null)
  const [reasonCode, setReasonCode] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const accept = async (line: OrderLine) => {
    setActionError(null); setBusyLine(line.id)
    try { await api.acceptLine(line.id); reload() }
    catch (e) { setActionError((e as Error).message) } finally { setBusyLine(null) }
  }

  const submitReturn = async () => {
    if (!returnFor || !reasonCode) { setActionError('Pick a reason.'); return }
    setActionError(null); setBusyLine(returnFor.id)
    try {
      await api.returnRequest(returnFor.id, reasonCode, note.trim() || undefined)
      setReturnFor(null); setReasonCode(null); setNote(''); reload()
    } catch (e) { setActionError((e as Error).message) } finally { setBusyLine(null) }
  }

  if (loading && !data) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  if (error) return <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>
  if (!data) return null

  const { order, lines } = data

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={{ paddingTop: insets.top + t.space.x1, paddingHorizontal: t.space.x4, paddingBottom: t.space.x2, flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={21} color={t.colors.text} />
        </Pressable>
        <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Order</Txt>
      </View>
      <ScrollView contentContainerStyle={{ padding: t.space.x4, paddingTop: t.space.x2, gap: t.space.x4, paddingBottom: t.space.x7 }}>
        <View style={{ gap: t.space.x2 }}>
          <Txt style={{ color: t.colors.textMuted, fontFamily: t.font.mono, fontSize: t.size.xs }}>{order.orderNumber}</Txt>
          <Muted size={t.size.xs}>Placed {dateTime(order.createdAt)}</Muted>
        </View>

        {justPaid ? (
          <StatusHero tone="good" badge="Paid" title="Payment confirmed 🎉" body="We'll prepare your item for dispatch." />
        ) : awaitingPayment ? (
          <StatusHero tone="warn" badge="Awaiting payment" title="This order is placed but not yet paid" />
        ) : (
          <StatusHero
            tone={stateTone(lines[0]?.state ?? order.state)}
            badge={(lines[0]?.state ?? order.state).replace(/_/g, ' ')}
            title="Where your order is"
            body={ORDER_BLURB[lines[0]?.state ?? order.state]}
          />
        )}

        <ProgressSection steps={orderSteps(order.state, lines[0])} label="ORDER STATUS" />

        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>Items</SectionTitle>
          {lines.map((l, i) => (
            <View key={l.id} style={{ gap: t.space.x2, marginTop: i === 0 ? 0 : t.space.x3, paddingTop: i === 0 ? 0 : t.space.x3, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: t.colors.bgSunken, borderWidth: 1, borderColor: t.colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="camera-outline" size={22} color={t.colors.brand} />
                </View>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space.x2, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: t.colors.goodSoft, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8 }}>
                    <Txt style={{ color: t.colors.good, fontSize: 10.5, fontWeight: t.weight.bold as never }}>Grade {l.gradeCodeAtSale}</Txt>
                  </View>
                  <StateBadge state={l.state} />
                </View>
                <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{money(l.itemPriceMinor)}</Txt>
              </View>
              {l.acceptanceWindowEndsAt && l.state === 'delivered' && (
                <Muted size={t.size.xs}>Accept by {dateTime(l.acceptanceWindowEndsAt)}, or it accepts automatically.</Muted>
              )}
              {l.state === 'delivered' && (
                <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
                  <Button label="Accept delivery" onPress={() => accept(l)} loading={busyLine === l.id} style={{ flex: 1 }} />
                  <Button label="Return" variant="ghost" onPress={() => { setReturnFor(l); setActionError(null) }} style={{ flex: 1 }} />
                </View>
              )}
              {l.state === 'return_requested' && <Muted size={t.size.xs}>Return requested — we'll be in touch.</Muted>}
              {l.acceptedAt && <Muted size={t.size.xs}>Accepted {dateTime(l.acceptedAt)}</Muted>}
              <VaultAdd lineId={l.id} state={l.state} />
            </View>
          ))}
        </Card>

        <Card style={{ gap: t.space.x2 }}>
          <SectionTitle>Summary</SectionTitle>
          <Row label="Subtotal" value={money(order.subtotalMinor)} />
          {order.shippingMinor > 0 && <Row label="Delivery" value={money(order.shippingMinor)} />}
          {order.taxMinor > 0 && <Row label="Tax" value={money(order.taxMinor)} />}
          {order.discountMinor > 0 && <Row label="Discount" value={`− ${money(order.discountMinor)}`} />}
          <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: 4 }} />
          <Row label="Total" value={money(order.totalMinor)} bold />
        </Card>

        {actionError && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{actionError}</Txt>}
      </ScrollView>

      <Modal visible={!!returnFor} transparent animationType="slide" onRequestClose={() => setReturnFor(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ backgroundColor: t.colors.bgRaised, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg, padding: t.space.x4, gap: t.space.x3 }}>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Request a return</Txt>
            <Muted size={t.size.xs}>Within the acceptance window you can send it back. Tell us why.</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
              {(reasons.data ?? []).map((r) => {
                const on = reasonCode === r.code
                return (
                  <Pressable key={r.code} onPress={() => setReasonCode(r.code)}
                    style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: on ? t.colors.accentSoft : t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }}>
                    <Txt style={{ color: on ? t.colors.accent : t.colors.text, fontSize: t.size.sm }}>{r.label}</Txt>
                  </Pressable>
                )
              })}
            </View>
            <Field label="Note (optional)" value={note} onChangeText={setNote} multiline />
            <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
              <Button label="Cancel" variant="ghost" onPress={() => setReturnFor(null)} style={{ flex: 1 }} />
              <Button label="Request return" variant="danger" onPress={submitReturn} loading={busyLine === returnFor?.id} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Txt style={{ color: bold ? t.colors.text : t.colors.textMuted, fontWeight: (bold ? t.weight.bold : t.weight.normal) as never }}>{label}</Txt>
      <Txt style={{ color: t.colors.text, fontWeight: (bold ? t.weight.bold : t.weight.normal) as never }}>{value}</Txt>
    </View>
  )
}
