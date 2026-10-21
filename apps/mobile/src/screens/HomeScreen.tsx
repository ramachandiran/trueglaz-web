import { useMemo } from 'react'
import { Image, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, isSeller, money, useApi, useSession, type HomeListing, type HomeSale, type Theme } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Badge, Card, Muted } from '../components/ui'
import { API_ORIGIN } from '../config'

export function HomeScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const home = useApi(() => api.home(), [])
  const images = useApi(() => api.modelImages(), [])
  const firstName = session?.displayName?.split(' ')[0] ?? null

  // The admin model pictures, keyed by slug, to stand in where a unit has no
  // photo of its own — the same images the web app and catalogue use.
  const stockBySlug = useMemo(
    () => new Map((images.data?.models ?? []).map((m) => [m.slug, API_ORIGIN + m.image.url])),
    [images.data],
  )
  const pic = (cover: { url: string } | null, modelSlug?: string | null) =>
    cover ? API_ORIGIN + cover.url : (modelSlug ? stockBySlug.get(modelSlug) ?? null : null)

  const d = home.data

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + t.space.x2, paddingBottom: t.space.x7, gap: t.space.x5 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Brand bar + search entry */}
      <View style={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never, letterSpacing: -0.5 }}>TrueGlaz</Txt>
            <Muted size={t.size.xs}>{firstName ? `Welcome back, ${firstName}` : 'Inspected used camera gear'}</Muted>
          </View>
          <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={8}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Txt style={{ color: t.colors.onBrand, fontWeight: t.weight.bold as never }}>
              {(firstName ?? 'G').slice(0, 1).toUpperCase()}
            </Txt>
          </Pressable>
        </View>

        <Pressable onPress={() => navigation.navigate('Shop')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, backgroundColor: t.colors.bgSunken, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.pill, paddingVertical: t.space.x3, paddingHorizontal: t.space.x4 }}>
          <Ionicons name="search" size={18} color={t.colors.textMuted} />
          <Muted>Search cameras, lenses, brands…</Muted>
        </Pressable>
      </View>

      {/* Hero */}
      <View style={{ paddingHorizontal: t.space.x4 }}>
        <View style={{ backgroundColor: t.colors.brand, borderRadius: t.radius.lg, padding: t.space.x5, gap: t.space.x3, overflow: 'hidden' }}>
          <Badge label="Inspected · Graded · Guaranteed" tone="accent" />
          <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xl, fontWeight: t.weight.bold as never, lineHeight: t.size.xl * 1.2 }}>
            Used gear you can actually trust
          </Txt>
          <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm, lineHeight: t.size.sm * 1.4 }}>
            Every camera and lens is checked and graded by TrueGlaz before it's listed — with a {d ? Math.round(d.returnWindowHours / 24) : 7}-day return window.
          </Txt>
          <Pressable onPress={() => navigation.navigate('Shop')}
            style={{ alignSelf: 'flex-start', marginTop: t.space.x1, backgroundColor: t.colors.cta, borderRadius: t.radius.md, paddingVertical: t.space.x3, paddingHorizontal: t.space.x5 }}>
            <Txt style={{ color: t.colors.onCta, fontWeight: t.weight.bold as never }}>Browse the shop</Txt>
          </Pressable>
        </View>
      </View>

      {/* Trust strip */}
      <View style={{ flexDirection: 'row', paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
        <Trust t={t} icon="shield-checkmark-outline" title="Inspected" sub="Bench-checked" />
        <Trust t={t} icon="ribbon-outline" title="Graded" sub="Honest condition" />
        <Trust t={t} icon="refresh-outline" title={`${d ? Math.round(d.returnWindowHours / 24) : 7}-day`} sub="Returns" />
      </View>

      {/* Shop by category */}
      {(d?.categories ?? []).length > 0 && (
        <Section title="Shop by category" t={t}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
            {d!.categories.map((c) => (
              <Pressable key={c.slug ?? c.name} onPress={() => navigation.navigate('Shop', { q: c.name })}
                style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, paddingVertical: t.space.x3, paddingHorizontal: t.space.x4, gap: 2, minWidth: 110 }}>
                <Ionicons name={categoryIcon(c.name)} size={20} color={t.colors.accent} />
                <Txt style={{ color: t.colors.text, fontWeight: t.weight.medium as never, marginTop: t.space.x1 }}>{c.name}</Txt>
                <Muted size={t.size.xs}>{c.liveCount} available</Muted>
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      )}

      {/* Just in */}
      {(d?.justIn ?? []).length > 0 && (
        <Section title="Just in" t={t} onSeeAll={() => navigation.navigate('Shop')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
            {d!.justIn.map((l) => <ListingCard key={l.id} l={l} t={t} img={pic(l.cover, l.modelSlug)} onPress={() => navigation.navigate('Listing', { id: l.id })} />)}
          </ScrollView>
        </Section>
      )}

      {/* Best savings */}
      {(d?.bestSavings ?? []).length > 0 && (
        <Section title="Biggest savings" t={t} onSeeAll={() => navigation.navigate('Shop')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
            {d!.bestSavings.map((l) => <ListingCard key={l.id} l={l} t={t} img={pic(l.cover, l.modelSlug)} onPress={() => navigation.navigate('Listing', { id: l.id })} />)}
          </ScrollView>
        </Section>
      )}

      {/* Recently sold */}
      {(d?.recentlySold ?? []).length > 0 && (
        <Section title="Recently sold" t={t}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
            {d!.recentlySold.map((s) => <SoldCard key={s.id} s={s} t={t} img={pic(s.cover, null)} />)}
          </ScrollView>
        </Section>
      )}

      {/* Sell CTA */}
      <View style={{ paddingHorizontal: t.space.x4 }}>
        <Card style={{ gap: t.space.x3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
            <View style={{ width: 44, height: 44, borderRadius: t.radius.md, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="cash-outline" size={22} color={t.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>
                {isSeller(session) ? 'Selling with TrueGlaz' : 'Got gear to sell?'}
              </Txt>
              <Muted size={t.size.xs}>
                {isSeller(session) ? 'Track consignments, prices and payouts.' : 'We inspect, grade, list and pay you when it sells.'}
              </Muted>
            </View>
          </View>
          <Pressable onPress={() => navigation.navigate('Sell')}
            style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, paddingVertical: t.space.x3, alignItems: 'center' }}>
            <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never }}>{isSeller(session) ? 'Open my selling' : 'Start selling'}</Txt>
          </Pressable>
        </Card>
      </View>
    </ScrollView>
  )
}

function Section({ title, t, onSeeAll, children }: { title: string; t: Theme; onSeeAll?: () => void; children: React.ReactNode }) {
  return (
    <View style={{ gap: t.space.x3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: t.space.x4 }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{title}</Txt>
        {onSeeAll && <Pressable onPress={onSeeAll} hitSlop={8}><Txt style={{ color: t.colors.accent, fontSize: t.size.sm, fontWeight: t.weight.medium as never }}>See all →</Txt></Pressable>}
      </View>
      {children}
    </View>
  )
}

function Trust({ t, icon, title, sub }: { t: Theme; icon: IconName; title: string; sub: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, paddingVertical: t.space.x3, alignItems: 'center', gap: 2 }}>
      <Ionicons name={icon} size={20} color={t.colors.accent} />
      <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.sm }}>{title}</Txt>
      <Muted size={t.size.xs}>{sub}</Muted>
    </View>
  )
}

function ListingCard({ l, t, img, onPress }: { l: HomeListing; t: Theme; img: string | null; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: 168 }}>
      <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.lg, overflow: 'hidden' }}>
        <View style={{ height: 130, backgroundColor: t.colors.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
          {img
            ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            : <Ionicons name="camera-outline" size={34} color={t.colors.textMuted} />}
          {l.savedPct != null && l.savedPct > 0 && (
            <View style={{ position: 'absolute', top: t.space.x2, left: t.space.x2, backgroundColor: t.colors.good, borderRadius: t.radius.pill, paddingHorizontal: t.space.x2, paddingVertical: 2 }}>
              <Txt style={{ color: '#fff', fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>Save {l.savedPct}%</Txt>
            </View>
          )}
        </View>
        <View style={{ padding: t.space.x3, gap: t.space.x1 }}>
          <Txt numberOfLines={1} style={{ color: t.colors.text, fontWeight: t.weight.medium as never }}>{l.title.split('·')[0].trim()}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2 }}>
            <Badge label={l.gradeCode} tone="accent" />
            {l.brandName && <Muted size={t.size.xs}>{l.brandName}</Muted>}
          </View>
          <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.md }}>{money(l.priceMinor)}</Txt>
          {l.msrpMinor != null && l.msrpMinor > l.priceMinor && (
            <Muted size={t.size.xs} style={{ textDecorationLine: 'line-through' }}>{money(l.msrpMinor)}</Muted>
          )}
        </View>
      </View>
    </Pressable>
  )
}

function SoldCard({ s, t, img }: { s: HomeSale; t: Theme; img: string | null }) {
  return (
    <View style={{ width: 140, opacity: 0.92 }}>
      <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.lg, overflow: 'hidden' }}>
        <View style={{ height: 100, backgroundColor: t.colors.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
          {img
            ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            : <Ionicons name="camera-outline" size={28} color={t.colors.textMuted} />}
          <View style={{ position: 'absolute', top: t.space.x2, left: t.space.x2 }}>
            <Badge label="Sold" tone="neutral" />
          </View>
        </View>
        <View style={{ padding: t.space.x3, gap: 2 }}>
          <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.medium as never }}>{s.title.split('·')[0].trim()}</Txt>
          <Muted size={t.size.xs}>{money(s.priceMinor)}</Muted>
        </View>
      </View>
    </View>
  )
}

type IconName = React.ComponentProps<typeof Ionicons>['name']

function categoryIcon(name: string): IconName {
  const n = name.toLowerCase()
  if (n.includes('lens')) return 'ellipse-outline'
  if (n.includes('camera') || n.includes('body')) return 'camera-outline'
  if (n.includes('accessor')) return 'construct-outline'
  if (n.includes('light') || n.includes('flash')) return 'flash-outline'
  if (n.includes('tripod') || n.includes('support')) return 'git-commit-outline'
  return 'pricetag-outline'
}
