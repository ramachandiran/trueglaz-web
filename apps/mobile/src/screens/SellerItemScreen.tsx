import { useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import {
  api, buildTimeline, dateTime, money, progressOf, STATE_BLURBS, STATE_LABELS, useApi,
  type SellerApprovalView,
} from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Timeline } from '../components/Timeline'
import { Button, Field } from '../components/form'
import { Badge, Card, ErrorNote, Loading, Muted, SectionTitle, StateBadge } from '../components/ui'

export function SellerItemScreen({ route }: { route: any }) {
  const t = useTheme()
  const id: string = route.params.id
  const item = useApi(() => api.item(id), [id])
  const approvals = useApi(() => api.myApprovals(), [])
  const models = useApi(() => api.models(), [])

  const steps = useMemo(
    () => (item.data ? buildTimeline(item.data.history, item.data.item.currentState, item.data.nextLegalStates) : []),
    [item.data],
  )
  const modelName = useMemo(() => {
    if (!item.data?.item.productModelId) return null
    return models.data?.content.find((m) => m.id === item.data!.item.productModelId)?.name ?? null
  }, [item.data, models.data])

  const pending = useMemo<SellerApprovalView | null>(
    () => (approvals.data ?? []).find((a) => a.approval.consignmentItemId === id && a.approval.decision === 'pending') ?? null,
    [approvals.data, id],
  )

  if (item.loading && !item.data) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  if (item.error) return <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4 }}><ErrorNote error={item.error} onRetry={item.reload} /></View>
  if (!item.data) return null

  const { item: it, defects, inspections } = item.data
  const progress = progressOf(steps)
  const reloadAll = () => { item.reload(); approvals.reload() }
  const isDraft = it.currentState === 'DRAFT'

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
      <View style={{ gap: t.space.x2 }}>
        <Txt style={{ color: t.colors.textMuted, fontFamily: t.font.mono, fontSize: t.size.xs }}>{it.internalSku}</Txt>
        <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>{modelName ?? it.modelFreeText ?? 'Consigned item'}</Txt>
        <View style={{ flexDirection: 'row', gap: t.space.x2, flexWrap: 'wrap' }}>
          <StateBadge state={it.currentState} />
          {it.assignedGradeCode && <Badge label={`Graded ${it.assignedGradeCode}`} tone="accent" />}
        </View>
        <Muted>Asking {money(it.askingAmountMinor)} · declared {it.declaredGradeCode}</Muted>
      </View>

      {isDraft && <SubmitForApproval submissionId={it.submissionId} onDone={reloadAll} />}

      {pending && <PriceDecision a={pending} onDone={reloadAll} />}

      <Card style={{ gap: t.space.x3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle>Where it is</SectionTitle>
          <Muted size={t.size.xs}>{progress.done} of {progress.total}</Muted>
        </View>
        <Muted>{STATE_BLURBS[it.currentState] ?? STATE_LABELS[it.currentState] ?? it.currentState}</Muted>
        <Timeline steps={steps} />
      </Card>

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

      <Card style={{ gap: t.space.x2 }}>
        <SectionTitle>History</SectionTitle>
        {[...item.data.history].reverse().map((h) => (
          <View key={h.id} style={{ borderBottomWidth: 1, borderBottomColor: t.colors.border, paddingVertical: t.space.x2 }}>
            <Txt style={{ color: t.colors.text, fontFamily: t.font.mono, fontSize: t.size.sm }}>
              {h.fromState ? `${STATE_LABELS[h.fromState] ?? h.fromState} → ` : ''}{STATE_LABELS[h.toState] ?? h.toState}
            </Txt>
            <Muted size={t.size.xs}>{(h.actorRole ?? 'System')} · {dateTime(h.occurredAt)}</Muted>
          </View>
        ))}
      </Card>
    </ScrollView>
  )
}

function SubmitForApproval({ submissionId, onDone }: { submissionId: string; onDone: () => void }) {
  const t = useTheme()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setError(null)
    try { await api.submitSubmission(submissionId); onDone() }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Card style={{ borderColor: t.colors.accent, gap: t.space.x3 }}>
      <SectionTitle>Ready to send?</SectionTitle>
      <Muted>This is still a draft. Send it to TrueGlaz for pre-approval, then ship it to us to be inspected and graded.</Muted>
      {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
      <Button label="Submit for pre-approval" variant="cta" loading={busy} onPress={submit} />
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
      <Button label="Decline & take it back" variant="danger" loading={busy} onPress={() => decide('declined')} />
      {canCounter && <Muted size={t.size.xs}>You get one counter. Declining returns the item to you.</Muted>}
    </Card>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Muted>{label}</Muted>
      <Txt style={{ color: t.colors.text, fontWeight: (strong ? t.weight.bold : t.weight.normal) as never }}>{value}</Txt>
    </View>
  )
}
