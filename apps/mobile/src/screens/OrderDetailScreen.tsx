import { useState } from 'react'
import { FormScroll } from '../components/FormScroll'
import { Pressable, View } from 'react-native'
import { BottomSheet } from '../components/BottomSheet'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import { api, dateTime, money, useApi, type OrderLine, type ReturnEvidence } from '@trueglaz/core'
import { historyEntries, LineReturnNote, OrderHistory } from '../components/LineHistoryList'
import { LineCancel } from '../components/LineCancel'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Card, ErrorNote, Loading, Muted } from '../components/ui'
import { sizedUri, useModelImages } from '../components/ModelImage'
import { DetailHeader, SummaryCard } from '../components/DetailParts'
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
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: status === 'adding' }} onPress={add} disabled={status === 'adding'}
      style={{ marginTop: t.space.x2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.colors.accent, borderRadius: 12, paddingVertical: 10, opacity: status === 'adding' ? 0.6 : 1 }}>
      <Ionicons name={status === 'error' ? 'refresh' : 'shield-outline'} size={16} color={t.colors.accent} />
      <Txt style={{ color: t.colors.accentText, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>
        {status === 'adding' ? 'Adding…' : status === 'error' ? 'Try again' : 'Add to my Gear Vault'}
      </Txt>
    </Pressable>
  )
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

  // Every line's history, loaded with the page: it dates "Last updated" at the
  // top and fills the History at the bottom (TG-182).
  const lineKey = (data?.lines ?? []).map((l) => `${l.id}:${l.state}`).join(',')
  const histories = useApi(
    () => Promise.all((data?.lines ?? []).map((l) => api.lineHistory(l.id))),
    [lineKey],
  )

  const [busyLine, setBusyLine] = useState<string | null>(null)
  const [returnFor, setReturnFor] = useState<OrderLine | null>(null)
  const [reasonCode, setReasonCode] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [video, setVideo] = useState<ReturnEvidence | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  // A cancellation request does not move the line, so its two halves (status
  // and button) are remounted to read it again.
  const [ver, setVer] = useState(0)
  const changed = () => { setVer((v) => v + 1); reload() }

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

  const first = lines[0]
  const delivered = lines.filter((l) => l.state === 'delivered')
  const owned = lines.filter((l) => OWNED_STATES.includes(l.state))
  // The things a buyer can do now that are not "cancel": accept or return what
  // arrived, keep it in the vault. They sit under the status, not at the bottom.
  const hasNextStep = delivered.length > 0 || owned.length > 0
  const thingTitle = (l: OrderLine) => (data.lineTitles?.[l.id] ?? 'Your item').split('·')[0].trim()
  const history = historyEntries(order.createdAt, lines.map((l, i) => ({
    what: lines.length > 1 ? thingTitle(l) : undefined, events: histories.data?.[i] ?? [],
  })))
  const pic = (l: OrderLine) => { const m = pictures.byId(data.lineModels?.[l.id]); return m ? sizedUri(m, 200) : null }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <DetailHeader title="Order" onBack={() => navigation.goBack()} />
      <FormScroll contentContainerStyle={{ padding: t.space.x4, paddingTop: t.space.x2, gap: t.space.x4, paddingBottom: t.space.x6 }}>
        <OrderIdCard number={order.orderNumber} placedAt={order.createdAt} updatedAt={history[0]?.at ?? order.createdAt} />

        <FadeIn>
        {justPaid ? (
          <StatusHero tone="good" badge="Paid" title="Payment confirmed 🎉" body="We'll prepare your item for dispatch." />
        ) : awaitingPayment || unpaid ? (
          <View style={{ gap: t.space.x3 }}>
            <StatusHero tone="warn" badge="Awaiting payment" title="This order is placed but not yet paid"
              body="Pay to confirm it. If it stays unpaid, the order lapses and the item goes back on sale." />
            {unpaid && <Button label={`Pay ${money(order.totalMinor)}`} variant="cta" onPress={() => navigation.navigate('Pay', { orderId: order.id })} />}
          </View>
        ) : null /* No "Where your order is" card: the Order status tracker below says it (TG-182). */}
        </FadeIn>

        {!unpaid && lines.map((l) => (
          <LineCancel key={`cs-${l.id}-${ver}`} lineId={l.id} state={l.state} totalMinor={order.totalMinor} onChanged={changed} part="status" />
        ))}

        {hasNextStep && (
          <Card style={{ gap: t.space.x3, borderColor: delivered.length ? t.colors.accent : t.colors.border }}>
            {delivered.map((l) => (
              <View key={l.id} style={{ gap: t.space.x2 }}>
                <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>Happy with {lines.length > 1 ? thingTitle(l) : 'it'}?</Txt>
                {l.acceptanceWindowEndsAt && (
                  <Muted size={t.size.xs}>Accept by {dateTime(l.acceptanceWindowEndsAt)}, or it accepts automatically.</Muted>
                )}
                <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
                  <Button label="Accept delivery" onPress={() => accept(l)} loading={busyLine === l.id} style={{ flex: 1 }} />
                  <Button label="Return" variant="ghost" onPress={() => { setReturnFor(l); setVideo(null); setActionError(null) }} style={{ flex: 1 }} />
                </View>
              </View>
            ))}
            {owned.map((l) => <VaultAdd key={l.id} lineId={l.id} state={l.state} />)}
          </Card>
        )}

        {/* Where a return stands, next to the actions rather than inside the summary. */}
        {lines.map((l) => <LineReturnNote key={`rn-${l.id}`} lineId={l.id} state={l.state} acceptedBy={l.acceptedBy} />)}

        {moved.ready ? (() => {
          const steps = orderSteps(order.state, first)
          // The step the buyer last saw as current; the replay starts there.
          let from = 0
          if (moved.changed && moved.from) {
            const [prevOrder, prevLine] = moved.from.split('/')
            const before = orderSteps(prevOrder, prevLine ? ({ ...first, state: prevLine } as OrderLine) : undefined)
            const at = before.findIndex((x) => x.state === 'current')
            from = Math.max(0, at === -1 ? before.length - 1 : at)
            if (before.length !== steps.length || before[from]?.title !== steps[from]?.title) from = 0
          }
          const label = unpaid ? 'Awaiting payment' : LINE_STATUS[first?.state ?? ''] ?? 'Updated'
          return (
            <ProgressSection steps={steps} label="ORDER STATUS" animateFrom={from} stepMs={moved.changed ? 280 : 90}
              aside={moved.changed ? (
                <Pop delay={250}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.colors.accentSoft, borderRadius: t.radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
                    <Ionicons name="sparkles" size={12} color={t.colors.accent} />
                    <Txt style={{ color: t.colors.accentText, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>Updated · {label}</Txt>
                  </View>
                </Pop>
              ) : undefined} />
          )
        })() : <View style={{ minHeight: 200 }} />}

        {/* TG-139: one designed summary — what was bought, with the same
            picture as the orders list, and what it cost. */}
        <SummaryCard
          label="Order summary"
          things={lines.map((l) => ({
            key: l.id,
            image: pic(l),
            title: thingTitle(l),
            chips: [
              { label: `Grade ${l.gradeCodeAtSale}`, tone: 'good' as const },
              { label: unpaid ? 'Awaiting payment' : LINE_STATUS[l.state] ?? l.state.replace(/_/g, ' '), tone: 'neutral' as const },
            ],
            sub: l.acceptedAt ? `Accepted ${dateTime(l.acceptedAt)}` : undefined,
            price: money(l.itemPriceMinor),
          }))}
          rows={[
            { label: `Item${lines.length > 1 ? `s (${lines.length})` : ''}`, value: money(order.subtotalMinor) },
            { label: 'Delivery', value: order.shippingMinor > 0 ? money(order.shippingMinor) : 'Free', tone: order.shippingMinor > 0 ? undefined : 'good' },
            ...(order.taxMinor > 0 ? [{ label: 'Tax', value: money(order.taxMinor) }] : []),
            ...(order.discountMinor > 0 ? [{ label: 'Discount', value: `− ${money(order.discountMinor)}`, tone: 'good' as const }] : []),
          ]}
          total={{ label: unpaid ? 'To pay' : 'Total paid', value: money(order.totalMinor) }}
        />

        <OrderHistory entries={history} loading={histories.loading} />

        {actionError && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{actionError}</Txt>}
      </FormScroll>

      {/* The only button at the bottom: calling the order off, while it can be. */}
      {!unpaid && lines.map((l) => (
        <LineCancel key={`ca-${l.id}-${ver}`} lineId={l.id} state={l.state} totalMinor={order.totalMinor} onChanged={changed} part="action" />
      ))}

      <BottomSheet visible={!!returnFor} onClose={() => setReturnFor(null)} scroll>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Request a return</Txt>
            <Muted size={t.size.xs}>Within the acceptance window you can send it back. Tell us why.</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
              {(reasons.data ?? []).map((r) => {
                const on = reasonCode === r.code
                return (
                  <Pressable accessibilityRole="radio" accessibilityState={{ checked: !!on }} key={r.code} onPress={() => setReasonCode(r.code)}
                    style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: on ? t.colors.accentSoft : t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }}>
                    <Txt style={{ color: on ? t.colors.accentText : t.colors.text, fontSize: t.size.sm, fontWeight: (on ? t.weight.bold : t.weight.normal) as never }}>{r.label}</Txt>
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
                  <Pressable accessibilityRole="button" accessibilityLabel="Replace video" hitSlop={12} onPress={() => setVideo(null)}><Txt style={{ color: t.colors.accentText, fontSize: t.size.sm }}>Replace</Txt></Pressable>
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


/**
 * The order's reference, made prominent (TG-182): the Order ID people quote to
 * support (still selectable, so it can be copied), and when the order last changed.
 */
function OrderIdCard({ number, placedAt, updatedAt }: { number: string; placedAt: string; updatedAt: string }) {
  const t = useTheme()
  return (
    <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 16, padding: t.space.x4, gap: t.space.x3 }}>
      <View style={{ gap: 2 }}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.6 }}>ORDER ID</Txt>
        <Txt selectable accessibilityLabel={`Order ID ${number.split('').join(' ')}`}
          style={{ color: t.colors.text, fontFamily: t.font.mono, fontSize: t.size.xl, fontWeight: t.weight.bold as never, letterSpacing: 0.5 }}>{number}</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.colors.accentSoft, borderRadius: t.radius.pill, paddingVertical: 6, paddingHorizontal: 12 }}>
          <Ionicons name="time-outline" size={15} color={t.colors.accentText} />
          <Txt style={{ color: t.colors.accentText, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>
            Last updated {dateTime(updatedAt)}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
          <Ionicons name="calendar-outline" size={14} color={t.colors.textMuted} />
          <Muted size={t.size.xs}>Placed {dateTime(placedAt)}</Muted>
        </View>
      </View>
    </View>
  )
}
