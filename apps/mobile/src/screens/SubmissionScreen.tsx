import { useEffect, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { api, money, STATE_LABELS, useApi } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button } from '../components/form'
import { Badge, Card, ErrorNote, Loading, Muted, SectionTitle, StateBadge } from '../components/ui'

export function SubmissionScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const id: string = route.params.id
  const { data, error, loading, reload } = useApi(() => api.submission(id), [id])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => navigation.addListener('focus', reload), [navigation, reload])

  if (loading && !data) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  if (error) return <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>
  if (!data) return null

  const { submission, items } = data
  const isDraft = submission.state === 'DRAFT' || submission.state === 'draft'

  const submit = async () => {
    setSubmitError(null); setSubmitting(true)
    try { await api.submitSubmission(id); reload() }
    catch (e) { setSubmitError((e as Error).message) } finally { setSubmitting(false) }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>Submission</Txt>
          <StateBadge state={submission.state} />
        </View>

        {submission.shipBy && <Muted size={t.size.xs}>Ship by {submission.shipBy}</Muted>}

        <View style={{ gap: t.space.x3 }}>
          <SectionTitle>Items ({items.length})</SectionTitle>
          {items.length === 0 && <Muted>No items yet — add your first one.</Muted>}
          {items.map((i) => (
            <Pressable key={i.id} onPress={() => navigation.navigate('SellerItem', { id: i.id })}>
              <Card style={{ gap: t.space.x2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt style={{ color: t.colors.text, fontWeight: t.weight.medium as never }} numberOfLines={1}>{i.description || i.modelFreeText || i.internalSku}</Txt>
                  <Badge label={i.declaredGradeCode} tone="accent" />
                </View>
                <Muted size={t.size.xs}>Asking {money(i.askingAmountMinor)} · {STATE_LABELS[i.currentState] ?? i.currentState}</Muted>
              </Card>
            </Pressable>
          ))}
        </View>

        {submitError && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{submitError}</Txt>}

        {isDraft && <Button label="＋ Add an item" variant="ghost" onPress={() => navigation.navigate('NewItem', { submissionId: id })} />}
      </ScrollView>

      {isDraft && items.length > 0 && (
        <View style={{ padding: t.space.x4, borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.bgRaised }}>
          <Button label="Submit for pre-approval" loading={submitting} onPress={submit} />
        </View>
      )}
    </View>
  )
}
