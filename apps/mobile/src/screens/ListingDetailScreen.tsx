import { useMemo } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { api, buildTimeline, money, useApi } from '@trueglaz/core'
import { useTheme } from '../theme/ThemeContext'
import { Timeline } from '../components/Timeline'
import { Badge, Card, ErrorNote, Loading, Muted, SectionTitle } from '../components/ui'

export function ListingDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const id: string = route.params.id
  const listing = useApi((a) => api.listing(a, id), [id])
  const itemId = listing.data?.listing.consignmentItemId
  const item = useApi((a) => (itemId ? api.item(a, itemId) : Promise.resolve(null)), [itemId])

  const steps = useMemo(
    () => (item.data ? buildTimeline(item.data.history, item.data.item.currentState, item.data.nextLegalStates) : []),
    [item.data],
  )

  if (listing.loading) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  if (listing.error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4 }}>
        <ErrorNote error={listing.error} onRetry={listing.reload} />
      </View>
    )
  }
  if (!listing.data) return null
  const d = listing.data

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.bg }}
      contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4 }}
    >
      <View style={{ gap: t.space.x2 }}>
        <Text style={{ color: t.colors.textMuted, fontFamily: t.font.mono, fontSize: t.size.xs }}>
          {d.internalSku}
        </Text>
        <Text style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>
          {d.listing.title.split('·')[0].trim()}
        </Text>
        <Text style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>
          {money(d.listing.priceMinor, d.listing.currency)}
        </Text>
        <View style={{ flexDirection: 'row', gap: t.space.x2, flexWrap: 'wrap' }}>
          <Badge label={d.listing.gradeCode} tone="accent" />
          {d.gradeLabel && <Badge label={d.gradeLabel} />}
          {d.gradePosition && <Badge label={d.gradePosition} />}
        </View>
      </View>

      <Card style={{ gap: t.space.x3 }}>
        <SectionTitle>What TrueGlaz found</SectionTitle>
        <Muted>{d.listing.descriptionGenerated}</Muted>
        {d.gradeDefinition && <Muted size={t.size.xs}>{d.listing.gradeCode} — {d.gradeDefinition}</Muted>}
        {d.defects.length > 0 &&
          d.defects.map((x) => (
            <View
              key={x.id}
              style={{ backgroundColor: t.colors.bgSunken, borderRadius: t.radius.md, padding: t.space.x3, gap: 4 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{x.title}</Text>
                <Badge label={x.severity} tone={x.severity === 'optical' ? 'bad' : x.severity === 'functional' ? 'warn' : 'neutral'} />
              </View>
              <Muted size={t.size.xs}>{x.descriptionPublic}</Muted>
            </View>
          ))}
      </Card>

      {steps.length > 0 && (
        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>Where this unit has been</SectionTitle>
          <Timeline steps={steps} />
          {itemId && (
            <Pressable onPress={() => navigation.navigate('Item', { id: itemId })}>
              <Text style={{ color: t.colors.accent }}>Full item record →</Text>
            </Pressable>
          )}
        </Card>
      )}
    </ScrollView>
  )
}
