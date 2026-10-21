import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, isSeller, money, STATE_LABELS, useApi, useSession } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button } from '../components/form'
import { Badge, Card, Empty, ErrorNote, Loading, Muted, SectionTitle, StateBadge } from '../components/ui'

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

  // Re-check identity whenever we land back here (e.g. returning from eKYC), so a
  // just-verified seller sees "awaiting approval", not "verify identity" again.
  useEffect(() => navigation.addListener('focus', () => { kyc.reload(); refresh() }), [navigation, kyc.reload, refresh])

  // Verified but not yet a seller = waiting on staff approval, NOT "go verify".
  const verified = kyc.data?.status === 'verified'
  const rejected = kyc.data?.status === 'rejected'

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ paddingTop: insets.top + t.space.x3, padding: t.space.x4, gap: t.space.x4 }}>
      <Txt style={{ color: t.colors.text, fontSize: t.size.xxl, fontWeight: t.weight.bold as never }}>Sell your gear</Txt>

      {verified ? (
        <Card style={{ borderColor: t.colors.warn, gap: t.space.x3 }}>
          <Badge label="Awaiting approval" tone="warn" />
          <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>
            You're verified — waiting for TrueGlaz to approve your selling account
          </Txt>
          <Muted>
            Your identity check passed{kyc.data?.legalName ? ` as ${kyc.data.legalName}` : ''}. Our team is reviewing your
            account to switch on selling — usually within a day. We'll notify you the moment it's approved; there's nothing
            else you need to do.
          </Muted>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, flexWrap: 'wrap' }}>
            <Txt style={{ color: t.colors.good, fontSize: t.size.sm }}>✓ Identity verified</Txt>
            <Muted size={t.size.sm}>·</Muted>
            <Txt style={{ color: t.colors.warn, fontSize: t.size.sm }}>⏳ Selling approval in progress</Txt>
          </View>
        </Card>
      ) : rejected ? (
        <Card style={{ borderColor: t.colors.bad, gap: t.space.x2 }}>
          <Badge label="Not approved" tone="bad" />
          <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>We couldn't verify your identity</Txt>
          <Muted>{kyc.data?.rejectedReasonCode ? `Reason: ${kyc.data.rejectedReasonCode}. ` : ''}You can try again.</Muted>
          <Button label="Try identity again" onPress={() => navigation.navigate('StartSelling')} />
        </Card>
      ) : (
        <>
          <Card style={{ gap: t.space.x3 }}>
            <SectionTitle>How it works</SectionTitle>
            {['Verify your identity (one-time KYC)', 'TrueGlaz reviews and enables your selling account', 'Submit your item and ship it to us', 'We inspect and grade it, then propose a price', 'You approve, we list it, and you get paid when it sells'].map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: t.space.x3 }}>
                <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never }}>{i + 1}</Txt>
                <Txt style={{ color: t.colors.text, flex: 1 }}>{s}</Txt>
              </View>
            ))}
          </Card>
          <Button label="Start selling — verify identity" onPress={() => navigation.navigate('StartSelling')} />
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
  const subs = useApi(() => api.mySubmissions(), [])
  const approvals = useApi(() => api.myApprovals(), [])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { items.reload(); subs.reload(); approvals.reload(); home.reload() })
    return unsub
  }, [navigation]) // eslint-disable-line react-hooks/exhaustive-deps

  const startSubmission = async () => {
    setCreateError(null); setCreating(true)
    try {
      // 'guided' lets TrueGlaz propose the price; must be 'guided' or 'manual'.
      // A submission holds one item (1:1), so go straight to the item form rather
      // than an empty submission page.
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
      <Txt style={{ color: t.colors.text, fontSize: t.size.xxl, fontWeight: t.weight.bold as never }}>Selling</Txt>

      {home.error && <ErrorNote error={home.error} onRetry={home.reload} />}

      {home.data && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x3 }}>
          <Tile label="Owed to you" value={money(home.data.money.owedMinor)} />
          <Tile label="Paid out" value={money(home.data.money.paidOutMinor)} />
          <Tile label="Listed / sold" value={`${home.data.money.itemCount} / ${home.data.money.soldCount}`} />
        </View>
      )}

      {(approvals.data ?? []).filter((a) => a.approval.decision === 'pending').length > 0 && (
        <View style={{ gap: t.space.x3 }}>
          <SectionTitle>Needs your decision</SectionTitle>
          {approvals.data!.filter((a) => a.approval.decision === 'pending').map((a) => (
            <Pressable key={a.approval.id} onPress={() => navigation.navigate('SellerItem', { id: a.approval.consignmentItemId })}>
              <Card style={{ borderColor: t.colors.warn, gap: t.space.x2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>Price to approve</Txt>
                  <Badge label="Action needed" tone="warn" />
                </View>
                <Txt style={{ color: t.colors.text }}>Proposed {money(a.proposedAmountMinor)} · you net {money(a.expectedNetMinor)}</Txt>
                <Muted size={t.size.xs}>{a.requiredBecause}</Muted>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <Card style={{ gap: t.space.x2 }}>
        <SectionTitle>Consign an item</SectionTitle>
        <Muted>Start a submission, add your gear, and ship it to us.</Muted>
        {createError && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{createError}</Txt>}
        <Button label="New submission" onPress={startSubmission} loading={creating} />
      </Card>

      <View style={{ gap: t.space.x3 }}>
        <SectionTitle>My submissions</SectionTitle>
        {subs.loading && !subs.data && <Loading />}
        {subs.data && subs.data.length === 0 && <Muted>No submissions yet.</Muted>}
        {(subs.data ?? []).map((s) => {
          const it = (items.data ?? []).find((i) => i.submissionId === s.id)
          const title = it ? (it.modelFreeText || it.description || it.internalSku) : 'Empty draft'
          return (
            <Pressable key={s.id} onPress={() => navigation.navigate('Submission', { id: s.id })}>
              <Card style={{ gap: t.space.x2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.space.x2 }}>
                  <Txt numberOfLines={1} style={{ color: t.colors.text, fontWeight: t.weight.medium as never, flex: 1 }}>{title}</Txt>
                  <StateBadge state={s.state} />
                </View>
                {it
                  ? <Muted size={t.size.xs}>{it.declaredGradeCode} · asking {money(it.askingAmountMinor)} · {s.pricingMode} pricing</Muted>
                  : <Muted size={t.size.xs}>No item added yet — tap to add one.</Muted>}
              </Card>
            </Pressable>
          )
        })}
      </View>

      <View style={{ gap: t.space.x3 }}>
        <SectionTitle>My items</SectionTitle>
        {items.loading && !items.data && <Loading />}
        {items.data && items.data.length === 0 && <Empty title="No items yet" hint="They appear once a submission is sent." />}
        {(items.data ?? []).map((i) => (
          <Pressable key={i.id} onPress={() => navigation.navigate('SellerItem', { id: i.id })}>
            <Card style={{ gap: t.space.x2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
                <Txt style={{ color: t.colors.text, fontFamily: t.font.mono, fontWeight: t.weight.medium as never }}>{i.internalSku}</Txt>
                <StateBadge state={i.currentState} />
              </View>
              <Muted size={t.size.xs}>
                {STATE_LABELS[i.currentState] ?? i.currentState} · asking {money(i.askingAmountMinor)}
                {i.assignedGradeCode ? ` · graded ${i.assignedGradeCode}` : ''}
              </Muted>
            </Card>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  const t = useTheme()
  return (
    <View style={{ flexGrow: 1, minWidth: 100, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.lg, padding: t.space.x3, gap: 2 }}>
      <Muted size={t.size.xs}>{label}</Muted>
      <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{value}</Txt>
    </View>
  )
}
