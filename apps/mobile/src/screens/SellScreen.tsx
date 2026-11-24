import { useEffect, useMemo, useState } from 'react'
import { notify } from '../components/Confirm'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, isSeller, money, STATE_LABELS, useApi, useSession, type ConsignmentItem, type Theme } from '@trueglaz/core'
import { PageTitle } from '../components/kit'
import { Txt, useLargeText } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button } from '../components/form'
import { Empty, ErrorNote, Loading, Muted } from '../components/ui'
import { ModelThumb, useModelImages } from '../components/ModelImage'
import { StatusHero } from '../components/StatusViews'

export function SellScreen({ navigation }: { navigation: any }) {
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  if (!isSeller(session)) return <SellerGate navigation={navigation} insets={insets} />
  return <SellerDashboard navigation={navigation} insets={insets} />
}

function SellerGate({ navigation, insets }: { navigation: any; insets: { top: number } }) {
  const t = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const kyc = useApi(() => api.myKyc(), [])
  const { refresh } = useSession()

  useEffect(() => navigation.addListener('focus', () => { kyc.reload(); refresh() }), [navigation, kyc.reload, refresh])

  const verified = kyc.data?.status === 'verified'
  const rejected = kyc.data?.status === 'rejected'

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
    <PageTitle title="Sell your gear" scrolled={scrolled} />
    <ScrollView style={{ flex: 1 }} onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)} scrollEventThrottle={32}
      contentContainerStyle={{ padding: t.space.x4, paddingTop: t.space.x2, gap: t.space.x4 }}>

      {verified ? (
        <StatusHero
          tone="warn"
          badge="Awaiting approval"
          title="You're verified — waiting for TrueGlaz to approve your selling account"
          body={`Your identity check passed${kyc.data?.legalName ? ` as ${kyc.data.legalName}` : ''}. Our team is reviewing your account to switch on selling — usually within a day. We'll notify you the moment it's approved; there's nothing else you need to do.`}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, flexWrap: 'wrap' }}>
            <Txt style={{ color: t.colors.good, fontSize: t.size.sm, fontWeight: t.weight.medium as never }}>✓ Identity verified</Txt>
            <Muted size={t.size.sm}>·</Muted>
            <Txt style={{ color: t.colors.warn, fontSize: t.size.sm, fontWeight: t.weight.medium as never }}>⏳ Selling approval in progress</Txt>
          </View>
        </StatusHero>
      ) : rejected ? (
        <StatusHero
          tone="bad"
          badge="Not approved"
          title="We couldn't verify your identity"
          body={`${kyc.data?.rejectedReasonCode ? `Reason: ${kyc.data.rejectedReasonCode}. ` : ''}You can try again.`}
        >
          <Button label="Try identity again" onPress={() => navigation.navigate('StartSelling')} />
        </StatusHero>
      ) : (
        <>
          <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 18, padding: t.space.x5, gap: t.space.x4 }}>
            <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>How selling works</Txt>
            {['Verify your identity (one-time KYC)', 'TrueGlaz reviews and enables your selling account', 'Submit your item and ship it to us', 'We inspect and grade it, then propose a price', 'You approve, we list it, and you get paid when it sells'].map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: t.space.x3, alignItems: 'flex-start' }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt style={{ color: t.colors.accentText, fontWeight: t.weight.bold as never, fontSize: t.size.xs }}>{i + 1}</Txt>
                </View>
                <Txt style={{ color: t.colors.text, flex: 1, fontSize: t.size.sm, lineHeight: 20 }}>{s}</Txt>
              </View>
            ))}
          </View>
          <Button label="Start selling — verify identity" variant="cta" onPress={() => navigation.navigate('StartSelling')} />
        </>
      )}

      {kyc.loading && !kyc.data && <Loading />}
    </ScrollView>
    </View>
  )
}

function SellerDashboard({ navigation, insets }: { navigation: any; insets: { top: number } }) {
  const t = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const large = useLargeText()
  const home = useApi(() => api.sellerHome(), [])
  const items = useApi(() => api.myItems(), [])
  const approvals = useApi(() => api.myApprovals(), [])
  const models = useApi(() => api.models(), [])
  const pictures = useModelImages()
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { items.reload(); approvals.reload(); home.reload() })
    return unsub
  }, [navigation]) // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = (i: { productModelId: string | null; modelFreeText: string | null; description: string | null; internalSku: string }) =>
    (i.productModelId ? models.data?.content.find((m) => m.id === i.productModelId)?.name : null)
    || i.modelFreeText || i.description || i.internalSku

  const pending = useMemo(() => (approvals.data ?? []).filter((a) => a.approval.decision === 'pending'), [approvals.data])

  const startSubmission = async () => {
    setCreateError(null); setCreating(true)
    try {
      // No submission yet: NewItem creates it when the first item is saved, so
      // opening the form and backing out leaves nothing behind (TG-9).
      navigation.navigate('NewItem', {})
    } catch (e) {
      const msg = (e as Error).message || 'Could not start a submission.'
      setCreateError(msg)
      notify('Could not start a submission', msg)
    } finally { setCreating(false) }
  }

  const pendingById = useMemo(() => new Map(pending.map((a) => [a.approval.consignmentItemId, a])), [pending])
  const [showClosed, setShowClosed] = useState(false)
  const groups = useMemo(() => {
    const g = { needs: [] as ConsignmentItem[], progress: [] as ConsignmentItem[], listed: [] as ConsignmentItem[], sold: [] as ConsignmentItem[], closed: [] as ConsignmentItem[] }
    for (const i of items.data ?? []) g[groupOf(i, pendingById.has(i.id))].push(i)
    return g
  }, [items.data, pendingById])

  // One item, as a card (TG-185): picture, name, status, price and grade, and
  // the next step in a strip when there is one.
  const card = (i: ConsignmentItem) => {
    const a = pendingById.get(i.id)
    const look = statusLook(t, i, !!a)
    const next = a ? { icon: 'pricetag-outline' as const, text: `Approve the price: ${money(a.proposedAmountMinor)}, you net ${money(a.expectedNetMinor)}` }
      : i.currentState === 'DRAFT' ? { icon: 'create-outline' as const, text: 'Finish and submit it' }
      : i.currentState === 'PRE_APPROVED' ? { icon: 'cube-outline' as const, text: 'Ship it to us and record it' }
      : null
    return (
      <Pressable accessibilityRole="button" key={i.id} onPress={() => navigation.navigate('SellerItem', { id: i.id })}
        accessibilityLabel={`${nameOf(i)}, ${look.label}${next ? `. ${next.text}` : ''}`}
        style={({ pressed }) => [{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: next ? t.colors.warn : t.colors.border, borderRadius: 16, overflow: 'hidden', opacity: pressed ? 0.85 : 1 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3, padding: 13 }}>
          <ModelThumb image={pictures.byId(i.productModelId)} size={64} />
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            <Txt numberOfLines={2} style={{ color: t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.md }}>{nameOf(i)}</Txt>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: look.bg, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 9 }}>
              <Ionicons name={look.icon} size={12} color={look.fg} />
              <Txt style={{ color: look.fg, fontSize: 11, fontWeight: t.weight.bold as never }}>{look.label}</Txt>
            </View>
            <Muted size={t.size.xs}>
              {money(i.askingAmountMinor)} asking{i.assignedGradeCode ? ` · graded ${i.assignedGradeCode}` : ''}{' · '}
              <Txt style={{ color: t.colors.textMuted, fontFamily: t.font.mono, fontSize: 11 }}>{i.internalSku}</Txt>
            </Muted>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
        </View>
        {next && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, backgroundColor: t.colors.warnSoft, paddingHorizontal: 13, paddingVertical: 9 }}>
            <Ionicons name={next.icon} size={15} color={t.colors.warn} />
            <Txt style={{ flex: 1, color: t.colors.warn, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>{next.text}</Txt>
          </View>
        )}
      </Pressable>
    )
  }

  if (home.loading && !home.data) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
    <PageTitle title="Selling" scrolled={scrolled} />
    <ScrollView style={{ flex: 1 }} onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)} scrollEventThrottle={32}
      contentContainerStyle={{ padding: t.space.x4, paddingTop: t.space.x2, gap: t.space.x5, paddingBottom: t.space.x7 }}>

      {home.error && <ErrorNote error={home.error} onRetry={home.reload} />}

      {home.data && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x3 }}>
          <Tile t={t} full={large} label="Owed to you" value={money(home.data.money.owedMinor)} highlight />
          <Tile t={t} full={large} label="Paid out" value={money(home.data.money.paidOutMinor)} />
          {/* Live in the shop now, not every item ever consigned (money.itemCount counts all states). */}
          <Tile t={t} full={large} label="Listed · Sold" value={`${items.data ? items.data.filter((i) => i.currentState === 'LISTED').length : '–'} · ${home.data.money.soldCount}`} />
        </View>
      )}

      {/* Anything waiting on the seller comes first (TG-185). */}
      {groups.needs.length > 0 && (
        <ItemGroup t={t} title="Needs you" count={groups.needs.length} tone="warn">
          {groups.needs.map(card)}
        </ItemGroup>
      )}

      <View style={{ backgroundColor: t.colors.brand, borderRadius: 18, padding: t.space.x5, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -30, top: -34, width: 150, height: 150, borderRadius: 75, backgroundColor: '#ffffff10' }} />
        <View style={{ position: 'absolute', right: t.space.x4, bottom: t.space.x3 }}>
          <Ionicons name="cube-outline" size={54} color={t.colors.brandAlt} />
        </View>
        <Txt style={{ color: t.colors.onBrand, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Consign an item</Txt>
        <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm, marginTop: 4, maxWidth: 220 }}>Add your gear and ship it to us. One form, start to finish.</Txt>
        {createError && <Txt style={{ color: t.colors.badSoft, fontSize: t.size.sm, marginTop: t.space.x2 }}>{createError}</Txt>}
        <Pressable accessibilityRole="button" onPress={startSubmission} disabled={creating}
          style={{ alignSelf: 'flex-start', marginTop: t.space.x3, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: t.colors.cta, borderRadius: 13, paddingVertical: t.space.x3, paddingHorizontal: t.space.x5, opacity: creating ? 0.6 : 1 }}>
          <Ionicons name="add" size={17} color={t.colors.onCta} />
          <Txt style={{ color: t.colors.onCta, fontWeight: t.weight.bold as never }}>{creating ? 'Starting…' : 'List an item'}</Txt>
        </Pressable>
      </View>

      {items.loading && !items.data && <Loading />}
      {items.data && items.data.length === 0 && <Empty title="No items yet" hint="Tap “List an item” to consign your first piece of gear." />}
      {groups.progress.length > 0 && <ItemGroup t={t} title="In progress" count={groups.progress.length}>{groups.progress.map(card)}</ItemGroup>}
      {groups.listed.length > 0 && <ItemGroup t={t} title="Listed" count={groups.listed.length} tone="good">{groups.listed.map(card)}</ItemGroup>}
      {groups.sold.length > 0 && <ItemGroup t={t} title="Sold" count={groups.sold.length} tone="good">{groups.sold.map(card)}</ItemGroup>}
      {groups.closed.length > 0 && (
        <ItemGroup t={t} title="Closed" count={groups.closed.length}
          aside={<Pressable onPress={() => setShowClosed(!showClosed)} accessibilityRole="button" accessibilityState={{ expanded: showClosed }} hitSlop={10}>
            <Txt style={{ color: t.colors.accentText, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{showClosed ? 'Hide' : 'Show'}</Txt>
          </Pressable>}>
          {showClosed ? groups.closed.map(card) : null}
        </ItemGroup>
      )}
    </ScrollView>
    </View>
  )
}

function Tile({ t, label, value, highlight, full }: { t: Theme; label: string; value: string; highlight?: boolean; full?: boolean }) {
  return (
    <View style={{ flex: 1, flexBasis: full ? '100%' : 0, backgroundColor: highlight ? t.colors.brand : t.colors.bgRaised, borderWidth: 1, borderColor: highlight ? 'transparent' : t.colors.border, borderRadius: 15, padding: 13, gap: 3 }}>
      <Txt style={{ color: highlight ? t.colors.onBrandMuted : t.colors.textMuted, fontSize: 10.5, fontWeight: t.weight.medium as never }}>{label}</Txt>
      <Txt style={{ color: highlight ? t.colors.onBrand : t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, letterSpacing: -0.4 }}>{value}</Txt>
    </View>
  )
}

type Group = 'needs' | 'progress' | 'listed' | 'sold' | 'closed'
const LISTED = new Set(['LISTED', 'RESERVED', 'RELISTED'])
const SOLD = new Set(['SOLD', 'DISPATCHED', 'DELIVERED', 'ACCEPTED'])
const CLOSED = new Set(['REJECTED_PRE_INTAKE', 'INSPECTION_FAILED', 'QUARANTINED', 'SELLER_DECLINED', 'RETURN_REQUESTED', 'RETURN_TO_SELLER',
  'RETURN_IN_TRANSIT', 'RETURN_RECEIVED', 'RETURNED', 'UNSOLD_REVIEW', 'ARCHIVED', 'EXPIRED'])

function groupOf(i: ConsignmentItem, priceWaiting: boolean): Group {
  if (priceWaiting || i.currentState === 'DRAFT' || i.currentState === 'PRE_APPROVED') return 'needs'
  if (i.withdrawnBySeller || CLOSED.has(i.currentState)) return 'closed'
  if (LISTED.has(i.currentState)) return 'listed'
  if (SOLD.has(i.currentState)) return 'sold'
  return 'progress'
}

type IconName = React.ComponentProps<typeof Ionicons>['name']

/** How an item's status reads in the list; a withdrawal says so (TG-191). */
function statusLook(t: Theme, i: ConsignmentItem, priceWaiting: boolean): { label: string; icon: IconName; fg: string; bg: string } {
  const warn = { fg: t.colors.warn, bg: t.colors.warnSoft }
  const good = { fg: t.colors.good, bg: t.colors.goodSoft }
  const plain = { fg: t.colors.textMuted, bg: t.colors.bgSunken }
  const bad = { fg: t.colors.bad, bg: t.colors.badSoft }
  if (i.withdrawnBySeller) return { label: i.currentState === 'RETURN_TO_SELLER' ? 'Taken off sale by you' : 'Withdrawn by you', icon: 'arrow-undo-outline', ...plain }
  if (priceWaiting) return { label: 'Price to approve', icon: 'pricetag-outline', ...warn }
  if (i.currentState === 'DRAFT') return { label: 'Draft', icon: 'create-outline', ...warn }
  if (i.currentState === 'PRE_APPROVED') return { label: 'Pre-approved', icon: 'checkmark-circle-outline', ...warn }
  if (LISTED.has(i.currentState)) return { label: STATE_LABELS[i.currentState] ?? i.currentState, icon: 'storefront-outline', ...good }
  if (SOLD.has(i.currentState)) return { label: STATE_LABELS[i.currentState] ?? i.currentState, icon: 'cash-outline', ...good }
  if (['REJECTED_PRE_INTAKE', 'INSPECTION_FAILED', 'QUARANTINED'].includes(i.currentState)) {
    return { label: i.currentState === 'REJECTED_PRE_INTAKE' ? 'Not approved' : STATE_LABELS[i.currentState] ?? i.currentState, icon: 'close-circle-outline', ...bad }
  }
  if (CLOSED.has(i.currentState)) return { label: STATE_LABELS[i.currentState] ?? i.currentState, icon: 'return-down-back-outline', ...plain }
  return { label: STATE_LABELS[i.currentState] ?? i.currentState, icon: 'time-outline', fg: t.colors.accentText, bg: t.colors.accentSoft }
}

function ItemGroup({ t, title, count, tone, aside, children }: {
  t: Theme; title: string; count: number; tone?: 'warn' | 'good'; aside?: React.ReactNode; children: React.ReactNode
}) {
  const dot = tone === 'warn' ? t.colors.warn : tone === 'good' ? t.colors.good : t.colors.textMuted
  return (
    <View style={{ gap: t.space.x3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
        <Txt accessibilityRole="header" style={{ flex: 1, color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>
          {title} <Txt style={{ color: t.colors.textMuted, fontWeight: t.weight.normal as never }}>· {count}</Txt>
        </Txt>
        {aside}
      </View>
      {children}
    </View>
  )
}
