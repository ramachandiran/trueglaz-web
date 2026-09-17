import { useMemo } from 'react'
import { ScrollView, View } from 'react-native'
import {
  api, buildTimeline, dateTime, money, progressOf, STATE_BLURBS, STATE_LABELS, useApi,
} from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Timeline } from '../components/Timeline'
import { Badge, Card, ErrorNote, Loading, Muted, SectionTitle, StateBadge } from '../components/ui'

function GradeStat({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  const t = useTheme()
  return (
    <View>
      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Txt>
      <Txt
        style={{
          color: highlight && value ? t.colors.accent : t.colors.text,
          fontSize: t.size.lg,
          fontWeight: t.weight.bold as never,
        }}
      >
        {value ?? '—'}
      </Txt>
    </View>
  )
}

export function ItemDetailScreen({ route }: { route: any }) {
  const t = useTheme()
  const id: string = route.params.id
  const { data, error, loading, reload } = useApi((a) => api.item(a, id), [id])
  const models = useApi((a) => api.models(a), [])

  const steps = useMemo(
    () => (data ? buildTimeline(data.history, data.item.currentState, data.nextLegalStates) : []),
    [data],
  )
  const modelName = useMemo(() => {
    if (!data?.item.productModelId) return null
    return models.data?.content.find((m) => m.id === data.item.productModelId)?.name ?? null
  }, [data, models.data])

  if (loading) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4 }}>
        <ErrorNote error={error} onRetry={reload} />
      </View>
    )
  }
  if (!data) return null

  const { item, defects, inspections, nextLegalStates, currentBinCode } = data
  const progress = progressOf(steps)

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.bg }}
      contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4 }}
    >
      <View style={{ gap: t.space.x2 }}>
        <Txt style={{ color: t.colors.textMuted, fontFamily: t.font.mono, fontSize: t.size.xs }}>
          {item.internalSku}
        </Txt>
        <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>
          {modelName ?? item.modelFreeText ?? 'Consigned item'}
        </Txt>
        <View style={{ flexDirection: 'row', gap: t.space.x2, flexWrap: 'wrap' }}>
          <StateBadge state={item.currentState} />
          {item.assignedGradeCode && <Badge label={item.assignedGradeCode} tone="accent" />}
          {currentBinCode && <Badge label={`Bin ${currentBinCode}`} />}
        </View>
        <Muted>Asking {money(item.askingAmountMinor)} · declared {item.declaredGradeCode}</Muted>
      </View>

      <Card style={{ gap: t.space.x3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle>Lifecycle</SectionTitle>
          <Muted size={t.size.xs}>{progress.done} of {progress.total} stages</Muted>
        </View>
        <Muted>{STATE_BLURBS[item.currentState] ?? STATE_LABELS[item.currentState] ?? item.currentState}</Muted>
        <Timeline steps={steps} />
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>What can happen next</SectionTitle>
        {nextLegalStates.length === 0 ? (
          <Muted>This item has reached the end of its journey.</Muted>
        ) : (
          nextLegalStates.map((n) => (
            <View
              key={n.toState}
              style={{ backgroundColor: t.colors.bgSunken, borderRadius: t.radius.md, padding: t.space.x3, gap: 4 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>
                  {STATE_LABELS[n.toState] ?? n.toState}
                </Txt>
                {n.requiresReason && <Badge label="needs a reason" tone="warn" />}
              </View>
              {n.notes && <Muted size={t.size.xs}>{n.notes}</Muted>}
              <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontFamily: t.font.mono }}>
                {n.allowedRoles.join(', ')}
              </Txt>
            </View>
          ))
        )}
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Inspection report</SectionTitle>
        {inspections.length === 0 ? (
          <Muted>Not inspected yet.</Muted>
        ) : (
          inspections.map((r) => (
            <View key={r.id} style={{ gap: t.space.x2 }}>
              <View style={{ flexDirection: 'row', gap: t.space.x2, flexWrap: 'wrap' }}>
                <Badge label={r.purpose} />
                <Badge
                  label={`QC ${r.qcState}`}
                  tone={r.qcState === 'confirmed' ? 'good' : r.qcState === 'overridden' ? 'warn' : 'neutral'}
                />
                {r.outcome && (
                  <Badge
                    label={r.outcome}
                    tone={r.outcome === 'graded' ? 'good' : r.outcome === 'quarantined' ? 'bad' : 'warn'}
                  />
                )}
              </View>

              {/* The grade-shaving audit trail: what the rubric said, what the
                  technician proposed, and what QC finally signed off. */}
              <View style={{ flexDirection: 'row', gap: t.space.x4 }}>
                <GradeStat label="Rubric" value={r.suggestedGradeCode} />
                <GradeStat label="Proposed" value={r.proposedGradeCode} />
                <GradeStat label="Final" value={r.finalGradeCode} highlight />
              </View>

              <Muted size={t.size.xs}>
                Submitted {dateTime(r.submittedAt)}{r.qcAt ? ` · QC ${dateTime(r.qcAt)}` : ''}
              </Muted>
            </View>
          ))
        )}
      </Card>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>Disclosed defects</SectionTitle>
        {defects.length === 0 ? (
          <Muted>The inspection found nothing to disclose.</Muted>
        ) : (
          defects.map((d) => (
            <View
              key={d.id}
              style={{ backgroundColor: t.colors.bgSunken, borderRadius: t.radius.md, padding: t.space.x3, gap: 4 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{d.title}</Txt>
                <Badge label={d.severity} tone={d.severity === 'optical' ? 'bad' : d.severity === 'functional' ? 'warn' : 'neutral'} />
              </View>
              <Muted size={t.size.xs}>{d.descriptionPublic}</Muted>
            </View>
          ))
        )}
      </Card>

      <Card style={{ gap: t.space.x2 }}>
        <SectionTitle>Full history</SectionTitle>
        <Muted size={t.size.xs}>Append-only. The current state is only a cache of this.</Muted>
        {[...data.history].reverse().map((h) => (
          <View key={h.id} style={{ borderBottomWidth: 1, borderBottomColor: t.colors.border, paddingVertical: t.space.x2 }}>
            <Txt style={{ color: t.colors.text, fontFamily: t.font.mono, fontSize: t.size.sm }}>
              {h.fromState ? `${h.fromState} → ` : ''}{h.toState}
            </Txt>
            <Muted size={t.size.xs}>
              {(h.actorRole ?? 'System')} · {dateTime(h.occurredAt)}{h.reasonCode ? ` · ${h.reasonCode}` : ''}
            </Muted>
          </View>
        ))}
      </Card>
    </ScrollView>
  )
}
