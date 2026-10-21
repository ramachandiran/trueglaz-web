import { ScrollView, View } from 'react-native'
import { api, money, useApi } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button } from '../components/form'
import { Badge, Card, ErrorNote, Loading, Muted, SectionTitle } from '../components/ui'

export function ListingDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const id: string = route.params.id
  const { data, error, loading, reload } = useApi(() => api.listing(id), [id])

  if (loading) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  if (error) return <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>
  if (!data) return null

  const d = data
  // A live listing's own state is 'published' (the item behind it is LISTED);
  // this is the same check the API's checkout uses.
  const buyable = d.listing.state === 'published'

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
        <View style={{ gap: t.space.x2 }}>
          <Txt style={{ color: t.colors.textMuted, fontFamily: t.font.mono, fontSize: t.size.xs }}>{d.internalSku}</Txt>
          <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>{d.listing.title.split('·')[0].trim()}</Txt>
          <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>{money(d.listing.priceMinor, d.listing.currency)}</Txt>
          <View style={{ flexDirection: 'row', gap: t.space.x2, flexWrap: 'wrap' }}>
            <Badge label={d.listing.gradeCode} tone="accent" />
            {d.gradeLabel && <Badge label={d.gradeLabel} />}
            {d.gradePosition && <Badge label={d.gradePosition} />}
            {!buyable && <Badge label="Not available" tone="warn" />}
          </View>
        </View>

        <Card style={{ gap: t.space.x3 }}>
          <SectionTitle>What TrueGlaz found</SectionTitle>
          {d.listing.descriptionGenerated && <Muted>{d.listing.descriptionGenerated}</Muted>}
          {d.gradeDefinition && <Muted size={t.size.xs}>{d.listing.gradeCode} — {d.gradeDefinition}</Muted>}
          <Muted size={t.size.xs}>A picture of this model, not of the item being sold.</Muted>
        </Card>

        {d.defects.length > 0 && (
          <Card style={{ gap: t.space.x3 }}>
            <SectionTitle>Disclosed condition</SectionTitle>
            {d.defects.map((x) => (
              <View key={x.id} style={{ backgroundColor: t.colors.bgSunken, borderRadius: t.radius.md, padding: t.space.x3, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{x.title}</Txt>
                  <Badge label={x.severity} tone={x.severity === 'optical' ? 'bad' : x.severity === 'functional' ? 'warn' : 'neutral'} />
                </View>
                <Muted size={t.size.xs}>{x.descriptionPublic}</Muted>
              </View>
            ))}
          </Card>
        )}

        {d.serialNumber && <Muted size={t.size.xs}>Serial on file · verified against the blocklist at intake</Muted>}
      </ScrollView>

      {buyable && (
        <View style={{ padding: t.space.x4, borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.bgRaised, flexDirection: 'row', alignItems: 'center', gap: t.space.x4 }}>
          <View style={{ flex: 1 }}>
            <Muted size={t.size.xs}>Price</Muted>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{money(d.listing.priceMinor, d.listing.currency)}</Txt>
          </View>
          <Button
            label="Buy now"
            variant="cta"
            onPress={() => navigation.navigate('Checkout', {
              listingId: d.listing.id, title: d.listing.title.split('·')[0].trim(),
              priceMinor: d.listing.priceMinor, currency: d.listing.currency,
            })}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </View>
  )
}
