import { uploadPhoto } from '../media/uploadPhoto'
import { FormScroll } from '../components/FormScroll'
import { useEffect, useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import {
  api, dateOnly, dateTime, HAPPY_PATH, money, OFF_PATH_TERMINALS, STATE_BLURBS, STATE_LABELS, useApi,
  type ItemStateTransition, type SellerApprovalView,
} from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { type TrackState, type TrackStep } from '../components/StatusTracker'
import { ProgressSection, StatusHero } from '../components/StatusViews'
import { Button, Field } from '../components/form'
import { Badge, Card, ErrorNote, Loading, Muted, SectionTitle, StateBadge, stateTone } from '../components/ui'
import { sizedUri, useModelImages } from '../components/ModelImage'
import { DetailHeader, DetailRef, StickyFooter, SummaryCard } from '../components/DetailParts'
import { confirm } from '../components/Confirm'

/** Where a seller can still call it off (TG-139), and how. */
const WITHDRAW_BOX = ['SUBMITTED', 'PRE_APPROVED']
const WITHDRAW_LISTED = ['LISTED', 'UNSOLD_REVIEW']

export function SellerItemScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const pictures = useModelImages()
  const id: string = route.params.id
  const item = useApi(() => api.item(id), [id])
  const approvals = useApi(() => api.myApprovals(), [])
  const models = useApi(() => api.models(), [])
  const brands = useApi(() => api.brands(), [])
  const categories = useApi(() => api.categories(), [])
  const photos = useApi(() => api.itemMedia(id), [id])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  // Back from Edit: read the draft again.
  useEffect(() => navigation.addListener('focus', () => { item.reload(); photos.reload() }), [navigation]) // eslint-disable-line react-hooks/exhaustive-deps

  const track = useMemo(
    () => (item.data ? sellerTrack(item.data.history, item.data.item.currentState) : []),
    [item.data],
  )
  const model = useMemo(
    () => (item.data?.item.productModelId ? models.data?.content.find((m) => m.id === item.data!.item.productModelId) ?? null : null),
    [item.data, models.data],
  )

  const pending = useMemo<SellerApprovalView | null>(
    () => (approvals.data ?? []).find((a) => a.approval.consignmentItemId === id && a.approval.decision === 'pending') ?? null,
    [approvals.data, id],
  )

  if (item.loading && !item.data) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  if (item.error) return <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4 }}><ErrorNote error={item.error} onRetry={item.reload} /></View>
  if (!item.data) return null

  const { item: it, defects, inspections, listings } = item.data
  const reloadAll = () => { item.reload(); approvals.reload() }
  const state = it.currentState
  const isDraft = state === 'DRAFT'
  const title = model?.name ?? it.modelFreeText ?? 'Consigned item'
  const brandName = brands.data?.find((b) => b.id === it.brandId)?.name
  const categoryName = categories.data?.find((c) => c.id === it.categoryId)?.name
  const pic = pictures.byId(it.productModelId)
  const live = listings.find((l) => l.state === 'published')
  const included = [it.hasBill && 'Bill', it.hasBox && 'Box', it.hasAccessories && 'Accessories'].filter(Boolean).join(' · ') || 'None'
  const canWithdraw = WITHDRAW_BOX.includes(state) || WITHDRAW_LISTED.includes(state)

  async function run(key: string, fn: () => Promise<unknown>, after?: () => void) {
    setBusy(key); setError(null)
    try { await fn(); after ? after() : reloadAll() }
    catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  const submit = () => run('submit', () => api.submitSubmission(it.submissionId))
  const edit = () => navigation.navigate('NewItem', { editItemId: it.id, submissionId: it.submissionId })
  async function deleteDraft() {
    if (!(await confirm({ title: 'Delete this draft?', message: 'It has not been sent to us. Its details and photos will be removed.', confirmLabel: 'Delete draft', destructive: true }))) return
    run('delete', () => api.withdrawSubmission(it.submissionId), () => navigation.goBack())
  }
  async function withdraw() {
    const listed = WITHDRAW_LISTED.includes(state)
    const ok = await confirm(listed
      ? { title: 'Take it off sale?', message: 'We will stop selling it and send it back to you. This cannot be undone.', confirmLabel: 'Take it off sale', cancelLabel: 'Keep it listed', destructive: true }
      : { title: 'Withdraw this item?', message: state === 'PRE_APPROVED' ? 'We will cancel the shipping label. Do not post it.' : 'We will stop reviewing it. You can send it again later.', confirmLabel: 'Withdraw', cancelLabel: 'Keep it', destructive: true })
    if (!ok) return
    run('withdraw', () => (listed ? api.withdrawItem(it.id) : api.withdrawSubmission(it.submissionId)))
  }

  const summary = (
    <SummaryCard
      label={isDraft ? 'Review your item' : 'Item summary'}
      things={[{
        key: it.id,
        image: pic ? sizedUri(pic, 200) : null,
        title,
        chips: [
          ...(it.assignedGradeCode ? [{ label: `Graded ${it.assignedGradeCode}`, tone: 'good' as const }] : []),
          { label: `You said ${it.declaredGradeCode}`, tone: 'neutral' as const },
          ...(!isDraft ? [{ label: STATE_LABELS[state] ?? state, tone: 'accent' as const }] : []),
        ],
        sub: [brandName, categoryName].filter(Boolean).join(' · ') || undefined,
        price: money(it.askingAmountMinor),
      }]}
      rows={[
        { label: 'Asking price', value: money(it.askingAmountMinor) },
        { label: 'Lowest you’d take', value: it.floorAmountMinor != null ? money(it.floorAmountMinor) : '—' },
        ...(live ? [{ label: 'Listed at', value: money(live.priceMinor), tone: 'good' as const }] : []),
        ...(pending ? [{ label: 'You’d receive', value: money(pending.expectedNetMinor), tone: 'good' as const }] : []),
        { label: 'Serial number', value: it.serialNumber ? (isDraft ? it.serialNumber : `••${it.serialNumber.slice(-4)}`) : '—' },
        { label: 'Under warranty', value: it.underWarranty ? 'Yes' : 'No' },
        { label: 'Included', value: included },
      ]}
    >
      {isDraft && (
        <View style={{ gap: t.space.x2 }}>
          <View style={{ gap: 2 }}>
            <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>DESCRIPTION</Txt>
            <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>{it.description || '—'}</Txt>
          </View>
          <View style={{ gap: 2 }}>
            <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>WHY YOU’RE SELLING</Txt>
            <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>{it.reasonToSell || '—'}</Txt>
          </View>
        </View>
      )}
    </SummaryCard>
  )

  const photoStrip = (photos.data?.length ?? 0) > 0 && (
    <View style={{ gap: t.space.x2 }}>
      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.6 }}>YOUR PHOTOS · {photos.data!.length}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space.x2 }}>
        {photos.data!.map((m) => (
          <Image key={m.id} source={{ uri: sizedUri(m, 200) }} style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: t.colors.bgSunken }} resizeMode="cover" />
        ))}
      </ScrollView>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <DetailHeader title={isDraft ? 'Review & submit' : 'My item'} onBack={() => navigation.goBack()} />
      <FormScroll contentContainerStyle={{ padding: t.space.x4, paddingTop: t.space.x2, gap: t.space.x4, paddingBottom: t.space.x6 }}>
        <DetailRef code={it.internalSku} when={`Added ${dateOnly(it.createdAt)}`} />

        {isDraft ? (
          <>
            <StatusHero tone="accent" badge="Draft — not sent yet" title="Check everything, then submit"
              body="Once you submit, TrueGlaz reviews it and tells you how to send it in. You can still edit it until then." />
            {summary}
            {photoStrip}
            <Pressable onPress={deleteDraft} disabled={!!busy} accessibilityRole="button" style={{ alignSelf: 'center', padding: t.space.x2 }}>
              <Txt style={{ color: t.colors.bad, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{busy === 'delete' ? 'Deleting…' : 'Delete draft'}</Txt>
            </Pressable>
          </>
        ) : (
          <>
            <StatusHero
              tone={stateTone(state)}
              badge={STATE_LABELS[state] ?? state}
              title="Where your item is"
              body={STATE_BLURBS[state] ?? STATE_LABELS[state] ?? state}
            />

            {state === 'PRE_APPROVED' && <ShipToUs submissionId={it.submissionId} itemId={it.id} onDone={reloadAll} />}
            {pending && <PriceDecision a={pending} onDone={reloadAll} />}

            <ProgressSection steps={track} label="ITEM STATUS" />

            {summary}
            {photoStrip}

            {inspections.length > 0 && (
              <Card style={{ gap: t.space.x3 }}>
                <SectionTitle>Inspection</SectionTitle>
                {inspections.map((r) => (
                  <View key={r.id} style={{ gap: t.space.x2 }}>
                    <View style={{ flexDirection: 'row', gap: t.space.x2, flexWrap: 'wrap' }}>
                      <Badge label={r.purpose} />
                      <Badge label={`QC ${r.qcState}`} tone={r.qcState === 'confirmed' ? 'good' : r.qcState === 'overridden' ? 'warn' : 'neutral'} />
                      {r.finalGradeCode && <Badge label={`Grade ${r.finalGradeCode}`} tone="accent" />}
                    </View>
                    <Muted size={t.size.xs}>Submitted {dateTime(r.submittedAt)}{r.qcAt ? ` · QC ${dateTime(r.qcAt)}` : ''}</Muted>
                  </View>
                ))}
              </Card>
            )}

            {defects.length > 0 && (
              <Card style={{ gap: t.space.x3 }}>
                <SectionTitle>What we disclosed</SectionTitle>
                {defects.map((d) => (
                  <View key={d.id} style={{ backgroundColor: t.colors.bgSunken, borderRadius: t.radius.md, padding: t.space.x3, gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{d.title}</Txt>
                      <Badge label={d.severity} tone={d.severity === 'optical' ? 'bad' : d.severity === 'functional' ? 'warn' : 'neutral'} />
                    </View>
                    <Muted size={t.size.xs}>{d.descriptionPublic}</Muted>
                  </View>
                ))}
              </Card>
            )}

            <View style={{ gap: t.space.x2 }}>
              <Pressable onPress={() => setHistoryOpen(!historyOpen)} hitSlop={6} accessibilityRole="button">
                <Txt style={{ color: t.colors.accentText, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{historyOpen ? 'Hide history' : 'History'}</Txt>
              </Pressable>
              {historyOpen && [...item.data.history].reverse().map((h) => (
                <View key={h.id} style={{ borderBottomWidth: 1, borderBottomColor: t.colors.border, paddingVertical: t.space.x2 }}>
                  <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>
                    {h.fromState ? `${STATE_LABELS[h.fromState] ?? h.fromState} → ` : ''}{STATE_LABELS[h.toState] ?? h.toState}
                  </Txt>
                  <Muted size={t.size.xs}>{(h.actorRole ?? 'System')} · {dateTime(h.occurredAt)}</Muted>
                </View>
              ))}
            </View>
          </>
        )}
        {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
      </FormScroll>

      {isDraft ? (
        <StickyFooter>
          <Button label="Edit" variant="ghost" onPress={edit} disabled={!!busy} style={{ flex: 1 }} />
          <Button label="Submit for review" variant="cta" onPress={submit} loading={busy === 'submit'} disabled={!!busy} style={{ flex: 2 }} />
        </StickyFooter>
      ) : canWithdraw ? (
        <StickyFooter>
          <Button label={WITHDRAW_LISTED.includes(state) ? 'Take it off sale' : 'Withdraw item'} variant="danger"
            onPress={withdraw} loading={busy === 'withdraw'} disabled={!!busy} style={{ flex: 1 }} />
        </StickyFooter>
      ) : null}
    </View>
  )
}

type Arranged = 'third_party' | 'trueglaz'

function ShipToUs({ submissionId, itemId, onDone }: { submissionId: string; itemId: string; onDone: () => void }) {
  const t = useTheme()
  const today = new Date().toISOString().slice(0, 10)
  const [arrangedBy, setArrangedBy] = useState<Arranged>('third_party')
  const [courierName, setCourierName] = useState('')
  const [consignmentId, setConsignmentId] = useState('')
  const [shippedDate, setShippedDate] = useState(today)
  const [weightKg, setWeightKg] = useState('')
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { setError('Allow photo access to attach a package photo.'); return }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 })
    if (!res.canceled) setPhoto(res.assets[0])
  }

  const submit = async () => {
    if (arrangedBy === 'third_party') {
      if (!courierName.trim()) { setError('Which courier did you use?'); return }
      if (!consignmentId.trim()) { setError('Enter the consignment / tracking id.'); return }
    }
    if (shippedDate && !/^\d{4}-\d{2}-\d{2}$/.test(shippedDate)) { setError('Date must be YYYY-MM-DD.'); return }
    if (weightKg && !(Number(weightKg) > 0)) { setError('Weight must be a positive number.'); return }
    if (!photo) { setError('A photo of the handed-over parcel is required.'); return }
    setError(null); setBusy(true)
    try {
      // Attach the optional package photo to the item before marking shipped,
      // so a failed upload does not leave the parcel "shipped" without it.
      if (photo) await uploadPhoto(photo, { ownerType: 'item', ownerId: itemId, role: 'seller_submission' })
      await api.shipSubmission(submissionId, {
        arrangedBy,
        courierName: arrangedBy === 'third_party' ? courierName.trim() : null,
        consignmentId: arrangedBy === 'third_party' ? consignmentId.trim() : null,
        shippedDate: shippedDate || null,
        weightGrams: weightKg ? Math.round(Number(weightKg) * 1000) : null,
      })
      onDone()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Card style={{ borderColor: t.colors.accent, gap: t.space.x3 }}>
      <SectionTitle>Ship it to us</SectionTitle>
      <Muted>You're pre-approved. Hand the parcel to a courier, then record it here so we know it's on the way.</Muted>

      <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
        {([['third_party', 'Courier by third party'], ['trueglaz', 'Courier by TG']] as [Arranged, string][]).map(([v, label]) => {
          const on = arrangedBy === v
          return (
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: !!on }} key={v} onPress={() => { setArrangedBy(v); setError(null) }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: on ? t.colors.accentSoft : t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }}>
              <Txt style={{ color: on ? t.colors.accentText : t.colors.text, fontSize: t.size.sm, fontWeight: (on ? t.weight.bold : t.weight.normal) as never, textAlign: 'center' }}>{label}</Txt>
            </Pressable>
          )
        })}
      </View>

      {arrangedBy === 'third_party' ? (
        <>
          <Field label="Courier vendor" value={courierName} onChangeText={setCourierName} placeholder="e.g. Blue Dart, DTDC" />
          <Field label="Consignment id" value={consignmentId} onChangeText={setConsignmentId} placeholder="Tracking number from the courier" autoCapitalize="characters" />
          <Field label="Date of shipment" value={shippedDate} onChangeText={setShippedDate} placeholder="YYYY-MM-DD" />
        </>
      ) : (
        <Muted size={t.size.xs}>TrueGlaz's courier collects using the label we sent you. We'll mark it on its way.</Muted>
      )}

      <Field label="Package weight in kg (optional)" value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" />

      <View style={{ gap: t.space.x2 }}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>Package photo (required)</Txt>
        {photo && <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 160, borderRadius: t.radius.md }} resizeMode="cover" />}
        <Button label={photo ? 'Change package photo' : 'Add package photo'} variant="ghost" onPress={pickPhoto} />
      </View>

      {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
      <Button label="Mark as shipped" variant="cta" loading={busy} onPress={submit} />
    </Card>
  )
}

function PriceDecision({ a, onDone }: { a: SellerApprovalView; onDone: () => void }) {
  const t = useTheme()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [counter, setCounter] = useState('')
  const canCounter = a.approval.counterRound < 1
  const typed = Number(counter)

  const decide = async (decision: string, amount?: number) => {
    setBusy(true); setError(null)
    try { await api.decideApproval(a.approval.id, decision, amount ?? null); onDone() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Card style={{ borderColor: t.colors.accent, gap: t.space.x3 }}>
      <SectionTitle>Your decision on the price</SectionTitle>
      <Muted size={t.size.xs}>{a.requiredBecause}</Muted>
      <View style={{ gap: 4 }}>
        <Row label="We'd list it at" value={money(a.proposedAmountMinor)} strong />
        <Row label="Our commission" value={money(a.commissionMinor)} />
        <Row label="You'd receive" value={money(a.expectedNetMinor)} strong />
      </View>
      <Muted size={t.size.xs}>You declared {a.declaredGradeCode}; we graded {a.assignedGradeCode ?? '—'}. These figures are locked in.</Muted>
      {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
      <Button label="Accept and list" variant="cta" loading={busy} onPress={() => decide('accepted')} />
      {canCounter && (
        <View style={{ flexDirection: 'row', gap: t.space.x2, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Counter price (₹)" value={counter} onChangeText={setCounter} keyboardType="number-pad" placeholder="e.g. 45000" />
          </View>
          <Button label="Counter" variant="ghost" disabled={busy || !typed || typed <= 0} onPress={() => decide('countered', Math.round(typed * 100))} />
        </View>
      )}
      <Button label="Decline & take it back" variant="danger" loading={busy} onPress={async () => {
        // Return shipping and handling are charged, so confirm before committing.
        if (await confirm({ title: 'Decline this price?', message: 'We will send it back to you. Return shipping and handling fees apply.', confirmLabel: 'Yes, decline', cancelLabel: 'Keep deciding', destructive: true })) decide('declined')
      }} />
      {canCounter && <Muted size={t.size.xs}>You get one counter. Declining returns the item to you.</Muted>}
    </Card>
  )
}

/**
 * The seller's journey, condensed from the 14 internal lifecycle states into
 * seven milestones the seller actually cares about, rendered with the same
 * StatusTracker as the Verification screen. `from`/`through` are indices into
 * HAPPY_PATH: the milestone is current while the item sits anywhere in that
 * span, and done once it has moved past `through`.
 */
// `from`/`through` (the HAPPY_PATH index span a milestone covers) are derived
// from `states` at runtime, so inserting a state into HAPPY_PATH can never
// silently shift these out of alignment.
const SELLER_MILESTONES: { title: string; desc: string; states: string[] }[] = [
  { title: 'Submitted', desc: 'Sent to TrueGlaz for review.', states: ['SUBMITTED'] },
  { title: 'Pre-approved', desc: 'Inbound label issued; ship it to us.', states: ['PRE_APPROVED', 'IN_TRANSIT_INBOUND'] },
  { title: 'Received at TrueGlaz', desc: 'In our custody and assigned a bin.', states: ['RECEIVED'] },
  { title: 'Inspection & grading', desc: 'Queued for a technician, then checked and graded.', states: ['AWAITING_INSPECTION', 'IN_INSPECTION', 'GRADED'] },
  { title: 'Price proposed', desc: 'We propose a price; you approve it.', states: ['PRICE_PROPOSED', 'AWAITING_SELLER_APPROVAL'] },
  { title: 'Listed', desc: 'Live in the catalogue and buyable.', states: ['LISTED', 'RESERVED'] },
  { title: 'Sold & paid', desc: 'You get paid once the sale completes.', states: ['SOLD', 'DISPATCHED', 'DELIVERED', 'ACCEPTED'] },
]

// A terminal that ends the journey early marks the milestone it stalled at as
// cancelled (a red ✕), with a seller-facing explanation. `at` is an index into
// SELLER_MILESTONES.
const SELLER_TERMINALS: Record<string, { at: number; title: string; desc: string }> = {
  REJECTED_PRE_INTAKE: { at: 1, title: 'Not pre-approved', desc: "TrueGlaz couldn't approve this submission." },
  INSPECTION_FAILED: { at: 3, title: 'Inspection failed', desc: 'It did not pass inspection.' },
  QUARANTINED: { at: 3, title: 'Quarantined', desc: 'Held back after inspection.' },
  SELLER_DECLINED: { at: 4, title: 'You declined the price', desc: 'The item is being returned to you.' },
  RETURN_REQUESTED: { at: 4, title: 'Return requested', desc: 'The item is being returned to you.' },
  RETURN_TO_SELLER: { at: 4, title: 'Returning to you', desc: 'On its way back to you.' },
  RETURN_IN_TRANSIT: { at: 4, title: 'Returning to you', desc: 'On its way back to you.' },
  RETURN_RECEIVED: { at: 4, title: 'Return received', desc: 'Back with TrueGlaz.' },
  RETURNED: { at: 4, title: 'Returned', desc: 'Back in your hands.' },
  UNSOLD_REVIEW: { at: 5, title: 'Unsold — under review', desc: "Didn't sell; we're reviewing next steps." },
  ARCHIVED: { at: 1, title: 'Archived', desc: 'This item was archived.' },
}

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

function sellerTrack(history: ItemStateTransition[], currentState: string): TrackStep[] {
  // When each state was last entered, for the date chips.
  const when = new Map<string, string>()
  for (const h of history) when.set(h.toState, h.occurredAt)

  // How far the item got along the happy path — from history, not just the
  // current state, so a declined/returned item still shows the stages it passed.
  const idxOf = (s: string) => HAPPY_PATH.indexOf(s as (typeof HAPPY_PATH)[number])
  let reached = idxOf(currentState)
  for (const h of history) reached = Math.max(reached, idxOf(h.toState))

  const terminal = OFF_PATH_TERMINALS.has(currentState) ? SELLER_TERMINALS[currentState] : undefined

  const steps: TrackStep[] = SELLER_MILESTONES.map((m, mi) => {
    const date = m.states.map((s) => when.get(s)).filter(Boolean).pop()

    if (terminal && mi === terminal.at) {
      return { title: terminal.title, desc: terminal.desc, state: 'cancelled', meta: date ? dayMonth(date) : undefined, tone: 'bad' }
    }

    // The happy-path span this milestone covers, derived from its states so a
    // newly inserted state cannot push the hardcoded numbers out of step.
    const idxs = m.states.map(idxOf).filter((i) => i >= 0)
    const from = Math.min(...idxs)
    const through = Math.max(...idxs)
    const done = reached > through
    const current = !terminal && reached >= from && reached <= through
    const state: TrackState = done ? 'done' : current ? 'current' : 'upcoming'
    if (state === 'done') return { ...base(m), state, meta: date ? dayMonth(date) : 'Done', tone: 'ok' }
    if (state === 'current') return { ...base(m), state, meta: 'In progress', tone: 'now' }
    return { ...base(m), state }
  })

  // Flag the next step to come, unless the journey has stalled at a terminal.
  if (!terminal) {
    const next = steps.findIndex((s) => s.state === 'upcoming')
    if (next >= 0) { steps[next].meta = 'Next'; steps[next].tone = 'next' }
  }
  return steps
}

const base = (m: { title: string; desc: string }) => ({ title: m.title, desc: m.desc })

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Muted>{label}</Muted>
      <Txt style={{ color: t.colors.text, fontWeight: (strong ? t.weight.bold : t.weight.normal) as never }}>{value}</Txt>
    </View>
  )
}
