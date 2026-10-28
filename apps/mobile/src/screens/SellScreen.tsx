import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, isSeller, money, STATE_LABELS, useApi, useSession, type Theme } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button } from '../components/form'
import { Empty, ErrorNote, Loading, Muted } from '../components/ui'
import { StatusHero } from '../components/StatusViews'

export function SellScreen({ navigation }: { navigation: any }) {
  const { session } = useSession()
  const insets = useSafeAreaInsets()
  if (!isSeller(session)) return <SellerGate navigation={navigation} insets={insets} />
  return <SellerDashboard navigation={navigation} insets={insets} />
}

function SellerGate({ navigation, insets }: { navigation: any; insets: { top: number } }) {
  const t = useTheme()
  const kyc = useApi(() => api.myKyc(), [])
  const { refresh } = useSession()

  useEffect(() => navigation.addListener('focus', () => { kyc.reload(); refresh() }), [navigation, kyc.reload, refresh])

  const verified = kyc.data?.status === 'verified'
  const rejected = kyc.data?.status === 'rejected'

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ paddingTop: insets.top + t.space.x3, padding: t.space.x4, gap: t.space.x4 }}>
      <Txt style={{ color: t.colors.text, fontSize: t.size.xxl, fontWeight: t.weight.bold as never, letterSpacing: -0.6 }}>Sell your gear</Txt>

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
                  <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never, fontSize: t.size.xs }}>{i + 1}</Txt>
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
  )
}

function SellerDashboard({ navigation, insets }: { navigation: any; insets: { top: number } }) {
  const t = useTheme()
  const home = useApi(() => api.sellerHome(), [])
  const items = useApi(() => api.myItems(), [])
  const approvals = useApi(() => api.myApprovals(), [])
  const models = useApi(() => api.models(), [])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { items.reload(); approvals.reload(); home.reload() })
    return unsub
  }, [navigation]) // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = (i: { productModelId: string | null; modelFreeText: string | null; description: string | null; internalSku: string }) =>
    (i.productModelId ? models.data?.content.find((m) => m.id === i.productModelId)?.name : null)
    || i.modelFreeText || i.description || i.internalSku

  const pendingIds = new Set((approvals.data ?? []).filter((a) => a.approval.decision === 'pending').map((a) => a.approval.consignmentItemId))
  const actionOf = (i: { id: string; currentState: string }) =>
    pendingIds.has(i.id) ? 'Price to approve' : i.currentState === 'DRAFT' ? 'Draft — finish & submit' : null

  const pending = useMemo(() => (approvals.data ?? []).filter((a) => a.approval.decision === 'pending'), [approvals.data])

  const startSubmission = async () => {
    setCreateError(null); setCreating(true)
    try {
      const s = await api.createSubmission('guided')
      navigation.navigate('NewItem', { submissionId: s.id })
    } catch (e) {
      const msg = (e as Error).message || 'Could not start a submission.'
      setCreateError(msg)
      Alert.alert('Could not start a submission', msg)
    } finally { setCreating(false) }
  }

  if (home.loading && !home.data) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ paddingTop: insets.top + t.space.x3, padding: t.space.x4, gap: t.space.x5, paddingBottom: t.space.x7 }}>
      <Txt style={{ color: t.colors.text, fontSize: t.size.xxl, fontWeight: t.weight.bold as never, letterSpacing: -0.6 }}>Selling</Txt>

      {home.error && <ErrorNote error={home.error} onRetry={home.reload} />}

      {home.data && (
        <View style={{ flexDirection: 'row', gap: t.space.x3 }}>
          <Tile t={t} label="Owed to you" value={money(home.data.money.owedMinor)} highlight />
          <Tile t={t} label="Paid out" value={money(home.data.money.paidOutMinor)} />
          <Tile t={t} label="Listed · Sold" value={`${home.data.money.itemCount} · ${home.data.money.soldCount}`} />
        </View>
      )}

      {pending.length > 0 && (
        <View style={{ gap: t.space.x3 }}>
          <SecLabel t={t}>Needs your decision</SecLabel>
          {pending.map((a) => {
            const it = (items.data ?? []).find((i) => i.id === a.approval.consignmentItemId)
            return (
              <Pressable key={a.approval.id} onPress={() => navigation.navigate('SellerItem', { id: a.approval.consignmentItemId })}
                style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1.5, borderColor: t.colors.warn, borderRadius: 16, padding: t.space.x4, gap: t.space.x2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.space.x2 }}>
                  <Txt numberOfLines={1} style={{ color: t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.md, flex: 1 }}>{it ? nameOf(it) : 'Price to approve'}</Txt>
                  <Pill t={t} tone="warn" label="Action needed" />
                </View>
                <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>
                  Proposed {money(a.proposedAmountMinor)} · you net <Txt style={{ color: t.colors.good, fontWeight: t.weight.bold as never }}>{money(a.expectedNetMinor)}</Txt>
                </Txt>
                <Muted size={t.size.xs}>{a.requiredBecause}</Muted>
              </Pressable>
            )
          })}
        </View>
      )}

      <View style={{ backgroundColor: t.colors.brand, borderRadius: 18, padding: t.space.x5, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -30, top: -34, width: 150, height: 150, borderRadius: 75, backgroundColor: '#ffffff10' }} />
        <View style={{ position: 'absolute', right: t.space.x4, bottom: t.space.x3 }}>
          <Ionicons name="cube-outline" size={54} color={t.colors.brandAlt} />
        </View>
        <Txt style={{ color: t.colors.onBrand, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Consign an item</Txt>
        <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm, marginTop: 4, maxWidth: 220 }}>Add your gear and ship it to us. One form, start to finish.</Txt>
        {createError && <Txt style={{ color: t.colors.badSoft, fontSize: t.size.sm, marginTop: t.space.x2 }}>{createError}</Txt>}
        <Pressable onPress={startSubmission} disabled={creating}
          style={{ alignSelf: 'flex-start', marginTop: t.space.x3, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: t.colors.cta, borderRadius: 13, paddingVertical: t.space.x3, paddingHorizontal: t.space.x5, opacity: creating ? 0.6 : 1 }}>
          <Ionicons name="add" size={17} color={t.colors.onCta} />
          <Txt style={{ color: t.colors.onCta, fontWeight: t.weight.bold as never }}>{creating ? 'Starting…' : 'List an item'}</Txt>
        </Pressable>
      </View>

      <View style={{ gap: t.space.x3 }}>
        <SecLabel t={t}>My items</SecLabel>
        {items.loading && !items.data && <Loading />}
        {items.data && items.data.length === 0 && <Empty title="No items yet" hint="Tap “List an item” to consign your first piece of gear." />}
        {(items.data ?? []).map((i) => {
          const action = actionOf(i)
          const tone = action ? 'warn' : i.currentState === 'LISTED' || i.currentState === 'SOLD' ? 'good' : 'neutral'
          return (
            <Pressable key={i.id} onPress={() => navigation.navigate('SellerItem', { id: i.id })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: action ? t.colors.warn : t.colors.border, borderRadius: 16, padding: 13 }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: t.colors.bgSunken, borderWidth: 1, borderColor: t.colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="camera-outline" size={22} color={t.colors.brand} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, flexWrap: 'wrap' }}>
                  <Txt numberOfLines={1} style={{ color: t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.md, flexShrink: 1 }}>{nameOf(i)}</Txt>
                  <Pill t={t} tone={tone} label={STATE_LABELS[i.currentState] ?? i.currentState} />
                </View>
                {action
                  ? <Txt style={{ color: t.colors.warn, fontSize: t.size.xs, fontWeight: t.weight.bold as never, marginTop: 4 }}>{action}</Txt>
                  : <Muted size={t.size.xs} style={{ marginTop: 4 }}>asking {money(i.askingAmountMinor)}{i.assignedGradeCode ? ` · graded ${i.assignedGradeCode}` : ''}</Muted>}
                <Txt style={{ color: t.colors.textMuted, fontFamily: t.font.mono, fontSize: 10.5, marginTop: 2 }}>{i.internalSku}</Txt>
              </View>
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}

function Tile({ t, label, value, highlight }: { t: Theme; label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: highlight ? t.colors.brand : t.colors.bgRaised, borderWidth: 1, borderColor: highlight ? 'transparent' : t.colors.border, borderRadius: 15, padding: 13, gap: 3 }}>
      <Txt style={{ color: highlight ? t.colors.onBrandMuted : t.colors.textMuted, fontSize: 10.5, fontWeight: t.weight.medium as never }}>{label}</Txt>
      <Txt style={{ color: highlight ? t.colors.onBrand : t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, letterSpacing: -0.4 }}>{value}</Txt>
    </View>
  )
}

function SecLabel({ t, children }: { t: Theme; children: React.ReactNode }) {
  return <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.7, textTransform: 'uppercase' }}>{children}</Txt>
}

function Pill({ t, tone, label }: { t: Theme; tone: 'good' | 'warn' | 'bad' | 'neutral'; label: string }) {
  const c = {
    good: { fg: t.colors.good, bg: t.colors.goodSoft },
    warn: { fg: t.colors.warn, bg: t.colors.warnSoft },
    bad: { fg: t.colors.bad, bg: t.colors.badSoft },
    neutral: { fg: t.colors.textMuted, bg: t.colors.bgSunken },
  }[tone]
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 9 }}>
      <Txt style={{ color: c.fg, fontSize: 10.5, fontWeight: t.weight.bold as never }}>{label}</Txt>
    </View>
  )
}
