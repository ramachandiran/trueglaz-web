import { Image, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, money, relative, useApi, type ListingPriceChange, type RenderedReport } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { ErrorNote, Loading, Muted } from '../components/ui'
import { API_ORIGIN } from '../config'

type IconName = React.ComponentProps<typeof Ionicons>['name']
type Fact = { icon: IconName; big: string; small: string }

export function ListingDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const id: string = route.params.id
  const { data, error, loading, reload } = useApi(() => api.listing(id), [id])
  // The admin model pictures, shared with the web app, as the fallback photo.
  const images = useApi(() => api.modelImages(), [])

  if (loading) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  if (error) return <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>
  if (!data) return null

  const d = data
  const buyable = d.listing.state === 'published'
  const stock = d.modelSlug ? images.data?.models.find((m) => m.slug === d.modelSlug)?.image : null
  const heroUrl = stock ? API_ORIGIN + stock.url : null

  const facts = d.inspectionReport ? aboutThisItem(d.inspectionReport, null) : []
  const tiles = keyFacts(d.inspectionReport)
  const drop = latestDrop(d.priceHistory)

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* image hero */}
        <View style={{ paddingHorizontal: t.space.x4, paddingTop: insets.top + t.space.x2 }}>
          <View style={{ height: 250, borderRadius: 22, backgroundColor: t.colors.bgSunken, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {heroUrl
              ? <Image source={{ uri: heroUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              : <Ionicons name="camera-outline" size={66} color={t.colors.textMuted} />}
            <Pressable onPress={() => navigation.goBack()} hitSlop={6}
              style={{ position: 'absolute', top: 14, left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,254,243,0.92)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={22} color={t.colors.text} />
            </Pressable>
            <Pressable hitSlop={6}
              style={{ position: 'absolute', top: 14, right: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,254,243,0.92)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="heart-outline" size={20} color={t.colors.text} />
            </Pressable>
            {heroUrl && (
              <View style={{ position: 'absolute', left: 14, bottom: 14, backgroundColor: 'rgba(26,46,59,0.74)', borderRadius: 9, paddingVertical: 5, paddingHorizontal: 11 }}>
                <Txt style={{ color: '#fff', fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>Model photo · not this unit</Txt>
              </View>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: t.space.x4, paddingTop: t.space.x4, gap: 0 }}>
          <Txt style={{ color: t.colors.textMuted, fontFamily: t.font.mono, fontSize: t.size.xs }}>{d.internalSku}</Txt>
          <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never, letterSpacing: -0.5, marginTop: 4 }}>
            {d.listing.title.split('·')[0].trim()}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9, flexWrap: 'wrap' }}>
            <Txt style={{ color: t.colors.text, fontSize: 26, fontWeight: t.weight.bold as never, letterSpacing: -0.8 }}>
              {money(d.listing.priceMinor, d.listing.currency)}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: t.colors.goodSoft, borderRadius: t.radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
              <Ionicons name="checkmark-circle" size={13} color={t.colors.good} />
              <Txt style={{ color: t.colors.good, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>
                Grade {d.listing.gradeCode}{d.gradePosition ? ` · ${d.gradePosition}` : ''}
              </Txt>
            </View>
            {!buyable && (
              <View style={{ backgroundColor: t.colors.warnSoft, borderRadius: t.radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
                <Txt style={{ color: t.colors.warn, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>Not available</Txt>
              </View>
            )}
          </View>
          {drop && (
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9, backgroundColor: t.colors.accentSoft, borderRadius: t.radius.pill, paddingVertical: 5, paddingHorizontal: 11 }}>
              <Ionicons name="arrow-down" size={13} color={t.colors.accentHover} />
              <Txt style={{ color: t.colors.accentHover, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>
                Price dropped {money(drop.amountMinor, d.listing.currency)} · {relative(drop.when)}
              </Txt>
            </View>
          )}
        </View>

        {/* key facts — real per-unit numbers */}
        {tiles.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: t.space.x4, marginTop: t.space.x4 }}>
            {tiles.map((f, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 15, paddingVertical: 13, paddingHorizontal: 6, alignItems: 'center', gap: 2 }}>
                <Ionicons name={f.icon} size={19} color={t.colors.accent} style={{ marginBottom: 3 }} />
                <Txt style={{ fontSize: t.size.lg, fontWeight: t.weight.bold as never, letterSpacing: -0.3 }}>{f.big}</Txt>
                <Txt style={{ fontSize: 10.5, color: t.colors.textMuted, fontWeight: t.weight.medium as never, textAlign: 'center' }}>{f.small}</Txt>
              </View>
            ))}
          </View>
        )}

        {/* what TrueGlaz found */}
        {(d.listing.descriptionGenerated || d.gradeDefinition) && (
          <Panel t={t} title="What TrueGlaz found">
            {d.listing.descriptionGenerated && <Muted style={{ lineHeight: 20 }}>{d.listing.descriptionGenerated}</Muted>}
            {d.gradeDefinition && (
              <View style={{ marginTop: t.space.x3, paddingTop: t.space.x3, borderTopWidth: 1, borderTopColor: t.colors.border }}>
                <Txt style={{ fontSize: t.size.xs, color: t.colors.textMuted, lineHeight: 18 }}>
                  <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{d.listing.gradeCode} — {d.gradeDefinition.split('.')[0]}.</Txt>
                  {d.gradeDefinition.includes('.') ? ` ${d.gradeDefinition.split('.').slice(1).join('.').trim()}` : ''}
                </Txt>
              </View>
            )}
          </Panel>
        )}

        {/* verified at inspection — real recorded facts */}
        {facts.length > 0 && (
          <Panel t={t} title="Verified at inspection">
            {facts.map((phrase, i) => {
              const bad = /^No |could not|warranty: (expired|out)/i.test(phrase)
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingVertical: 7, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.colors.border }}>
                  <Ionicons name={bad ? 'alert-circle' : 'checkmark-circle'} size={17} color={bad ? t.colors.warn : t.colors.good} style={{ marginTop: 1 }} />
                  <Txt style={{ flex: 1, fontSize: t.size.sm, fontWeight: t.weight.medium as never, lineHeight: 19 }}>{phrase}</Txt>
                </View>
              )
            })}
          </Panel>
        )}

        {/* disclosed condition */}
        {d.defects.length > 0 && (
          <Panel t={t} title="Disclosed condition">
            {d.defects.map((x, i) => (
              <View key={x.id} style={{ backgroundColor: t.colors.bgSunken, borderRadius: 12, padding: 12, marginTop: i === 0 ? 0 : 9 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <Txt style={{ flex: 1, color: t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.sm }}>{x.title}</Txt>
                  <View style={{ borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8, backgroundColor: x.severity === 'optical' ? t.colors.badSoft : t.colors.bgRaised, borderWidth: x.severity === 'optical' ? 0 : 1, borderColor: t.colors.border }}>
                    <Txt style={{ fontSize: 10.5, fontWeight: t.weight.bold as never, color: x.severity === 'optical' ? t.colors.bad : t.colors.textMuted }}>{x.severity}</Txt>
                  </View>
                </View>
                <Muted size={t.size.xs} style={{ marginTop: 3 }}>{x.descriptionPublic}</Muted>
              </View>
            ))}
          </Panel>
        )}

        {facts.length === 0 && d.serialNumber && (
          <View style={{ paddingHorizontal: t.space.x4, marginTop: t.space.x4 }}>
            <Muted size={t.size.xs}>Serial on file · verified against the blocklist at intake</Muted>
          </View>
        )}
      </ScrollView>

      {buyable && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: t.space.x4, paddingTop: t.space.x3, paddingBottom: insets.bottom + t.space.x3, borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.bgRaised, flexDirection: 'row', alignItems: 'center', gap: t.space.x4 }}>
          <View>
            <Muted size={t.size.xs}>Price</Muted>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{money(d.listing.priceMinor, d.listing.currency)}</Txt>
          </View>
          <Pressable
            onPress={() => navigation.navigate('Checkout', {
              listingId: d.listing.id, title: d.listing.title.split('·')[0].trim(),
              priceMinor: d.listing.priceMinor, currency: d.listing.currency,
            })}
            style={{ flex: 1, backgroundColor: t.colors.cta, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
            <Txt style={{ color: t.colors.onCta, fontWeight: t.weight.bold as never, fontSize: t.size.md }}>Buy now</Txt>
          </Pressable>
        </View>
      )}
    </View>
  )
}

function Panel({ t, title, children }: { t: any; title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginHorizontal: t.space.x4, marginTop: t.space.x4, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 18, padding: t.space.x4 }}>
      <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never, marginBottom: 10 }}>{title}</Txt>
      {children}
    </View>
  )
}

/** Up to three quantitative, per-unit facts a used-gear buyer judges on. */
function keyFacts(report: RenderedReport | null): Fact[] {
  if (!report) return []
  const answers = new Map(report.sections.flatMap((s) => s.answers).map((a) => [a.code, a]))
  const tiles: Fact[] = []
  if (report.verifiedShutterCount != null) {
    const low = report.verifiedShutterCount < 20000
    tiles.push({ icon: 'time-outline', big: report.verifiedShutterCount.toLocaleString('en-IN'), small: low ? 'actuations · low' : 'actuations' })
  }
  const year = answers.get('year_of_manufacture')?.displayValue
  if (year) tiles.push({ icon: 'calendar-outline', big: year, small: 'year made' })
  const ws = answers.get('warranty_status')?.displayValue
  if (ws && /in warranty/i.test(ws)) tiles.push({ icon: 'shield-checkmark-outline', big: 'Yes', small: 'under warranty' })
  if (tiles.length < 3) tiles.push({ icon: 'checkmark-done-outline', big: String(report.answeredCount), small: 'QC checks' })
  return tiles.slice(0, 3)
}

/** The most recent genuine price reduction, for the "price dropped" signal. */
function latestDrop(history: ListingPriceChange[]): { amountMinor: number; when: string } | null {
  const drops = history.filter((p) => p.newAmountMinor < p.oldAmountMinor)
  if (drops.length === 0) return null
  const last = drops.reduce((a, b) => (new Date(a.changedAt) > new Date(b.changedAt) ? a : b))
  return { amountMinor: last.oldAmountMinor - last.newAmountMinor, when: last.changedAt }
}

/**
 * Buyer-facing facts straight from the signed-off inspection — the same
 * selection the web listing page shows. Nothing is invented: each line appears
 * only when the technician actually recorded it.
 */
function aboutThisItem(report: RenderedReport | null | undefined, fallback: string | null): string[] {
  if (!report) return fallback ? [fallback] : []
  const answers = new Map(report.sections.flatMap((s) => s.answers).map((a) => [a.code, a]))
  const say = (code: string, phrase: (value: string) => string) => {
    const a = answers.get(code)
    return a?.displayValue ? phrase(a.displayValue) : null
  }
  return [
    report.verifiedShutterCount != null
      ? `Shutter count verified at ${report.verifiedShutterCount.toLocaleString('en-IN')} actuations`
      : null,
    say('year_of_manufacture', (v) => `Made in ${v}`),
    say('warranty_status', (v) => v === 'in warranty'
      ? `Still under manufacturer warranty${answers.get('warranty_expiry')?.displayValue ? `, to ${answers.get('warranty_expiry')!.displayValue}` : ''}`
      : `Manufacturer warranty: ${v}`),
    say('purchase_proof', (v) => v === 'both'
      ? 'Original invoice and box included'
      : `Paperwork: ${v.replace(/_/g, ' ')}`),
    say('serial_verified', (v) => v === 'Yes'
      ? 'Serial number checked against the body and the blocklist'
      : 'Serial number could not be verified'),
    say('sensor_condition', (v) => `Sensor ${v}`),
    say('front_element', (v) => `Front element ${v}`),
    say('caps_hood', (v) => v === 'Yes' ? 'Caps and hood included' : 'No caps or hood'),
    say('charger_included', (v) => v === 'Yes' ? 'Charger included' : 'No charger'),
    `${report.answeredCount} checks recorded, signed off by QC`,
  ].filter((x): x is string => x !== null).slice(0, 7)
}
