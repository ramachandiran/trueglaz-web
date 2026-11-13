import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { BottomSheet } from '../components/BottomSheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import { api, dateTime, money, useApi, type OrderLine, type ReturnEvidence } from '@trueglaz/core'
import { LineReturnAndHistory } from '../components/LineHistoryList'
import { LineCancel } from '../components/LineCancel'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Badge, Card, ErrorNote, Loading, Muted, SectionTitle, stateTone } from '../components/ui'
import { ModelThumb, useModelImages } from '../components/ModelImage'
import { type TrackStep } from '../components/StatusTracker'
import { ProgressSection, StatusHero } from '../components/StatusViews'
import { FadeIn, Pop, statusKey, useStatusChange } from '../components/motion'

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

/** What a line's state means to the buyer, in words (never the raw code). */
const LINE_STATUS: Record<string, string> = {
  open: 'Preparing to ship',
  packing: 'Preparing to ship',
  dispatched: 'On the way',
  delivered: 'Delivered',
  accepted: 'Completed',
  cancelled: 'Cancelled',
  return_requested: 'Return requested',
  returned: 'Returned',
}

/**
 * How far along the six-step journey a line is: the index of the step that is
 * in progress. Payment is confirmed before a line exists as `open`, so an open
 * line is already preparing to ship, and an accepted one is past the end (every
 * step done, none "in progress").
 */
const STAGE: Record<string, number> = { open: 2, packing: 2, dispatched: 3, delivered: 4, accepted: 6 }

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
  // An order still waiting for its money is on the payment step.
  const stage = orderState === 'pending_payment' ? 1 : STAGE[s] ?? 2
  const defs = [
    { title: 'Order placed', desc: undefined as string | undefined },
    { title: 'Payment confirmed', desc: undefined },
    { title: 'Preparing to ship', desc: undefined },
    { title: 'On the way', desc: undefined },
    // The accept-by date only matters while it is still the buyer's move.
    { title: 'Delivered', desc: s === 'delivered' && line?.acceptanceWindowEndsAt ? `Accept by ${dateTime(line.acceptanceWindowEndsAt)}` : undefined },
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
  const pictures = useModelImages()
  const reasons = useApi(() => api.reasonCodes('return'), [])

  // TG-120: has this order moved since the buyer last opened it? If so the
  // tracker replays from the step it was on; opening it marks it seen.
  const firstLine = data?.lines?.[0]
  const moved = useStatusChange(id, data ? statusKey(data.order.state, firstLine?.state) : undefined, 'commit')

  const [busyLine, setBusyLine] = useState<string | null>(null)
  const [returnFor, setReturnFor] = useState<OrderLine | null>(null)
  const [reasonCode, setReasonCode] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [video, setVideo] = useState<ReturnEvidence | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  // TG-90: the unboxing video is what the return is judged on. Recorded now
  // or picked from the gallery; uploaded straight to storage with progress.
  const pickVideo = async (source: 'camera' | 'library') => {
    if (!returnFor) return
    setActionError(null)
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { setActionError(source === 'camera' ? 'Allow camera access to record the video.' : 'Allow access to your videos to choose one.'); return }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['videos'], videoMaxDuration: 300, quality: 1 }
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts)
    if (res.canceled) return
    const a = res.assets[0]
    if (a.fileSize && a.fileSize > 200 * 1024 * 1024) { setActionError('That video is over 200 MB. Record a shorter clip.'); return }
    const type = a.mimeType && ['video/mp4', 'video/quicktime', 'video/webm'].includes(a.mimeType) ? a.mimeType
      : (a.fileName ?? a.uri).toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'
    setProgress(0)
    try {
      const blob = await (await fetch(a.uri)).blob()
      setVideo(await api.uploadReturnVideo(returnFor.id, blob, type, a.fileName ?? 'unboxing.mp4', setProgress))
    } catch (e) { setActionError((e as Error).message) } finally { setProgress(null) }
  }

  const accept = async (line: OrderLine) => {
    setActionError(null); setBusyLine(line.id)
    try { await api.acceptLine(line.id); reload() }
    catch (e) { setActionError((e as Error).message) } finally { setBusyLine(null) }
  }

  const submitReturn = async () => {
    if (!returnFor || !reasonCode) { setActionError('Pick a reason.'); return }
    if (!video) { setActionError('Add your unboxing video.'); return }
    setActionError(null); setBusyLine(returnFor.id)
    try {
      await api.returnRequest(returnFor.id, reasonCode, note.trim() || undefined, video.id)
      setReturnFor(null); setReasonCode(null); setNote(''); setVideo(null); reload()
    } catch (e) { setActionError((e as Error).message) } finally { setBusyLine(null) }
  }

  if (loading && !data) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  if (error) return <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>
  if (!data) return null

  const { order, lines } = data
  const unpaid = order.state === 'pending_payment'

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

        <FadeIn>
        {justPaid ? (
          <StatusHero tone="good" badge="Paid" title="Payment confirmed 🎉" body="We'll prepare your item for dispatch." />
        ) : awaitingPayment || unpaid ? (
          <View style={{ gap: t.space.x3 }}>
            <StatusHero tone="warn" badge="Awaiting payment" title="This order is placed but not yet paid"
              body="Pay to confirm it. If it stays unpaid, the order lapses and the item goes back on sale." />
            {unpaid && <Button label={`Pay ${money(order.totalMinor)}`} variant="cta" onPress={() => navigation.navigate('Pay', { orderId: order.id })} />}
          </View>
        ) : (
          <StatusHero
            tone={stateTone(lines[0]?.state ?? order.state)}
            badge={LINE_STATUS[lines[0]?.state ?? ''] ?? (lines[0]?.state ?? order.state).replace(/_/g, ' ')}
            title="Where your order is"
            body={ORDER_BLURB[lines[0]?.state ?? order.state]}
          />
        )}
        </FadeIn>

        {moved.ready ? (() => {
          const steps = orderSteps(order.state, lines[0])
          // The step the buyer last saw as current; the replay starts there.
          let from = 0
          if (moved.changed && moved.from) {
            const [prevOrder, prevLine] = moved.from.split('/')
            const before = orderSteps(prevOrder, prevLine ? ({ ...lines[0], state: prevLine } as OrderLine) : undefined)
            const at = before.findIndex((x) => x.state === 'current')
            from = Math.max(0, at === -1 ? before.length - 1 : at)
            if (before.length !== steps.length || before[from]?.title !== steps[from]?.title) from = 0
          }
          const label = unpaid ? 'Awaiting payment' : LINE_STATUS[lines[0]?.state ?? ''] ?? 'Updated'
          return (
            <ProgressSection steps={steps} label="ORDER STATUS" animateFrom={from} stepMs={moved.changed ? 280 : 90}
              aside={moved.changed ? (
                <Pop delay={250}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.colors.accentSoft, borderRadius: t.radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
                    <Ionicons name="sparkles" size={12} color={t.colors.accent} />
                    <Txt style={{ color: t.colors.accent, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>Updated · {label}</Txt>
                  </View>
                </Pop>
              ) : undefined} />
          )
        })() : <View style={{ minHeight: 200 }} />}

        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>Items</SectionTitle>
          {lines.map((l, i) => (
            <View key={l.id} style={{ gap: t.space.x2, marginTop: i === 0 ? 0 : t.space.x3, paddingTop: i === 0 ? 0 : t.space.x3, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
                <ModelThumb image={pictures.byId(data.lineModels?.[l.id])} size={48} />
                <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                  <Txt numberOfLines={2} style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>
                    {(data.lineTitles?.[l.id] ?? 'Your item').split('·')[0].trim()}
                  </Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, flexWrap: 'wrap' }}>
                    <View style={{ backgroundColor: t.colors.goodSoft, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8 }}>
                      <Txt style={{ color: t.colors.good, fontSize: 10.5, fontWeight: t.weight.bold as never }}>Grade {l.gradeCodeAtSale}</Txt>
                    </View>
                    <Badge label={unpaid ? 'Awaiting payment' : LINE_STATUS[l.state] ?? l.state.replace(/_/g, ' ')} tone={stateTone(l.state)} />
                  </View>
                </View>
                <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{money(l.itemPriceMinor)}</Txt>
              </View>
              {l.acceptanceWindowEndsAt && l.state === 'delivered' && (
                <Muted size={t.size.xs}>Accept by {dateTime(l.acceptanceWindowEndsAt)}, or it accepts automatically.</Muted>
              )}
              {l.state === 'delivered' && (
                <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
                  <Button label="Accept delivery" onPress={() => accept(l)} loading={busyLine === l.id} style={{ flex: 1 }} />
                  <Button label="Return" variant="ghost" onPress={() => { setReturnFor(l); setVideo(null); setActionError(null) }} style={{ flex: 1 }} />
                </View>
              )}
              {!unpaid && <LineCancel lineId={l.id} state={l.state} totalMinor={order.totalMinor} onChanged={reload} />}
              <LineReturnAndHistory lineId={l.id} state={l.state} acceptedBy={l.acceptedBy} />
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

      <BottomSheet visible={!!returnFor} onClose={() => setReturnFor(null)} scroll>
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
            <Field label="What is wrong?" value={note} onChangeText={setNote} placeholder="A few words: what you found when you opened it"
              multiline submitBehavior="blurAndSubmit" returnKeyType="done" maxLength={500} />
            <View style={{ gap: t.space.x2 }}>
              <Txt style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>Unboxing video (required)</Txt>
              <Muted size={t.size.xs}>The video you took opening the parcel: the seal, the item and the problem. Up to 200 MB. Only you and our team can see it.</Muted>
              {video ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color={t.colors.good} />
                  <Txt style={{ color: t.colors.good, fontSize: t.size.sm, fontWeight: t.weight.bold as never, flex: 1 }}>Video uploaded</Txt>
                  <Pressable onPress={() => setVideo(null)}><Txt style={{ color: t.colors.accent, fontSize: t.size.sm }}>Replace</Txt></Pressable>
                </View>
              ) : progress !== null ? (
                <View style={{ height: 24, borderRadius: 12, backgroundColor: t.colors.border, overflow: 'hidden', justifyContent: 'center' }}>
                  <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(progress * 100)}%`, backgroundColor: t.colors.cta }} />
                  <Txt style={{ textAlign: 'center', fontSize: t.size.xs, color: t.colors.text }}>Uploading… {Math.round(progress * 100)}%</Txt>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
                  <Button label="Record video" variant="ghost" onPress={() => pickVideo('camera')} style={{ flex: 1 }} />
                  <Button label="Choose video" variant="ghost" onPress={() => pickVideo('library')} style={{ flex: 1 }} />
                </View>
              )}
            </View>
            {actionError && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{actionError}</Txt>}
            <View style={{ gap: t.space.x2 }}>
              <Button label="Request return" variant="cta" onPress={submitReturn} loading={busyLine === returnFor?.id} disabled={!video || progress !== null || !reasonCode} />
              <Button label="Cancel" variant="ghost" onPress={() => setReturnFor(null)} />
            </View>
      </BottomSheet>
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
