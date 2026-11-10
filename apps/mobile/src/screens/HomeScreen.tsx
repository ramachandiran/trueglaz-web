import { useMemo } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, isSeller, money, useApi, useSession, type BuyerHome, type HomeListing, type HomeSale, type Theme, type VaultItem } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { mediaUri, sizedUri } from '../components/ModelImage'
import { GearArt, Pill, PhotoBadge, ProductCard, RoundIcon, SectionHead, lift } from '../components/kit'

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/**
 * Home, in the 2026 layout: a greeting, one full-width hero with the thing
 * most worth acting on, a count of orders on the way (never their details,
 * those are in Orders), then rails of gear and a "For you" grid built from the
 * person's own vault. Signed out, the hero is the invitation to sell.
 */
export function HomeScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const home = useApi(() => api.home(), [])
  const images = useApi(() => api.modelImages(), [])
  const notif = useApi(() => api.notifications(), [])
  const mine = useApi(() => (session ? api.buyerHome() : Promise.resolve(null)), [session?.userId])
  const vault = useApi(() => (session ? api.vault() : Promise.resolve(null)), [session?.userId])
  const firstName = session?.displayName?.split(' ')[0] ?? null
  const unread = notif.data?.unread ?? 0

  // Admin model pictures keyed by slug, to stand in where a unit has no photo.
  const stockBySlug = useMemo(
    () => new Map((images.data?.models ?? []).map((m) => [m.slug, sizedUri(m.image, 400)])),
    [images.data],
  )
  const pic = (cover: { url: string } | null, modelSlug?: string | null) =>
    cover ? mediaUri(cover.url) : (modelSlug ? stockBySlug.get(modelSlug) ?? null : null)

  const d = home.data
  const b = mine.data ?? null
  const onTheWay = b?.stats.inProgress ?? 0
  const rail = (title: string, sub: string, list: HomeListing[]) => list.length > 0 && (
    <View>
      <SectionHead title={title} sub={sub} onAll={() => navigation.navigate('Shop')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: 14, paddingBottom: 6 }}>
        {list.map((l) => (
          <ProductCard key={l.id} g={l} width={152} img={pic(l.cover, l.modelSlug)} onPress={() => navigation.navigate('Listing', { id: l.id })} />
        ))}
      </ScrollView>
    </View>
  )

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + t.space.x2, paddingBottom: t.space.x7, gap: t.space.x5 }}
      showsVerticalScrollIndicator={false}
    >
      {/* greeting */}
      <View style={{ paddingHorizontal: t.space.x4, flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
        <Pressable onPress={() => navigation.navigate('Profile')} accessibilityRole="button" accessibilityLabel="Profile"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Txt style={{ color: t.colors.onBrand, fontWeight: t.weight.bold as never }}>{(firstName ?? 'T').slice(0, 1).toUpperCase()}</Txt>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{greeting()}</Txt>
          <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{firstName ?? 'Welcome'}</Txt>
        </View>
        <RoundIcon icon="search" label="Search" onPress={() => navigation.navigate('Shop')} />
        <View>
          <RoundIcon icon="notifications-outline" label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onPress={() => navigation.navigate('Notifications')} />
          {unread > 0 && <View style={{ position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: t.colors.cta, borderWidth: 2, borderColor: t.colors.bgRaised }} />}
        </View>
      </View>

      <Hero t={t} b={b} signedIn={!!session} seller={isSeller(session)} navigation={navigation} />

      {onTheWay > 0 && (
        <Pressable onPress={() => navigation.navigate('Orders')} accessibilityRole="link"
          style={[{ marginHorizontal: t.space.x4, marginTop: -t.space.x2, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: t.colors.bgRaised, borderRadius: t.radius.pill, paddingVertical: 9, paddingHorizontal: 16 }, lift(t)]}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.good }} />
          <Txt style={{ fontSize: t.size.sm, color: t.colors.text }}>
            <Txt style={{ fontWeight: t.weight.bold as never }}>{onTheWay}</Txt> {onTheWay === 1 ? 'order' : 'orders'} on the way · Track
          </Txt>
        </Pressable>
      )}

      {rail('Just in', 'Fresh off the inspection bench', d?.justIn ?? [])}

      {session && <ForYou t={t} vault={vault.data ?? null} seller={isSeller(session)} navigation={navigation} />}

      {rail('Biggest savings', 'Against the new price', d?.bestSavings ?? [])}

      {(d?.recentlySold ?? []).length > 0 && (
        <View>
          <SectionHead title="Recently sold" sub="What buyers actually paid here" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: 12 }}>
            {d!.recentlySold.map((s) => <SoldCard key={s.id} s={s} t={t} img={pic(s.cover, s.modelSlug)} />)}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  )
}

/** The one full-width banner: the request that came true, new arrivals, or (signed out) selling. */
function Hero({ t, b, signedIn, seller, navigation }: { t: Theme; b: BuyerHome | null; signedIn: boolean; seller: boolean; navigation: any }) {
  const ask = b?.asks.find((a) => (a.matchCount ?? 0) > 0) ?? null
  const from = ask && ask.matches.length ? Math.min(...ask.matches.map((m) => m.priceMinor)) : 0
  const content = ask
    ? { kicker: 'Matches your request', title: `Your ${ask.matches[0]?.title ?? ask.wanted} is in.`, sub: `${ask.matchCount} in stock at your price${from ? ` · from ${money(from)}` : ''}`, cta: 'See matches', go: () => navigation.navigate('Shop', { q: ask.matches[0]?.title ?? ask.wanted, at: Date.now() }) }
    : signedIn
      ? { kicker: 'Just in', title: 'Fresh off the bench.', sub: 'Graded in our workshop, every defect written down', cta: 'Shop new arrivals', go: () => navigation.navigate('Shop') }
      : { kicker: 'Sell with TrueGlaz', title: 'Sell your gear, get paid.', sub: 'We inspect, price and sell it for you', cta: seller ? 'Open my selling' : 'Start selling', go: () => navigation.navigate('Sell') }
  return (
    <View style={{ backgroundColor: t.colors.brand, minHeight: 232, paddingHorizontal: 20, paddingVertical: 22, overflow: 'hidden', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', right: -36, top: 24 }}>
        <Ionicons name="camera" size={176} color={t.colors.brandAlt} />
        <View style={{ position: 'absolute', left: 74, top: 72, width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.cta }} />
      </View>
      <Txt style={{ color: t.colors.brandAccent, fontSize: 11, fontWeight: t.weight.bold as never, letterSpacing: 1.4, textTransform: 'uppercase' }}>{content.kicker}</Txt>
      <Txt accessibilityRole="header" style={{ color: t.colors.onBrand, fontSize: 34, fontWeight: t.weight.bold as never, letterSpacing: -0.8, lineHeight: 36, marginTop: 10, maxWidth: 240 }}>{content.title}</Txt>
      <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm, marginTop: 8, maxWidth: 250 }}>{content.sub}</Txt>
      <View style={{ marginTop: 16 }}><Pill label={content.cta} small onPress={content.go} /></View>
    </View>
  )
}

/**
 * Three tiles from the person's own things: what their kit is worth (tall,
 * navy), what their most valuable item could fetch, and selling.
 */
function ForYou({ t, vault, seller, navigation }: { t: Theme; vault: VaultItem[] | null; seller: boolean; navigation: any }) {
  const items = vault ?? []
  const worth = items.reduce((n, i) => n + (i.valuation?.midMinor ?? i.costMinor ?? 0), 0)
  const insured = items.filter((i) => i.policy).length
  const best = [...items].filter((i) => i.valuation).sort((x, y) => y.valuation!.midMinor - x.valuation!.midMinor)[0] ?? null
  const small = (kicker: string, title: string, go: () => void) => (
    <Pressable onPress={go} accessibilityRole="button" style={[{ flex: 1, backgroundColor: t.colors.bgRaised, borderRadius: 14, padding: 14, minHeight: 150 }, lift(t)]}>
      <Txt style={{ color: t.colors.cta, fontSize: 11, fontWeight: t.weight.bold as never, letterSpacing: 1.2, textTransform: 'uppercase' }}>{kicker}</Txt>
      <Txt style={{ color: t.colors.text, fontSize: t.size.md + 1, fontWeight: t.weight.bold as never, marginTop: 8, marginRight: 8 }}>{title}</Txt>
      <View style={{ position: 'absolute', right: 10, bottom: 10 }}><RoundIcon icon="arrow-forward" label={title} onPress={go} size={34} /></View>
    </Pressable>
  )
  return (
    <View>
      <SectionHead title="For you" sub="From your vault" />
      <View style={{ paddingHorizontal: t.space.x4, flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => navigation.navigate('Vault')} accessibilityRole="button"
          style={{ flex: 1, backgroundColor: t.colors.brand, borderRadius: 14, padding: 16, overflow: 'hidden', justifyContent: 'space-between', minHeight: 312 }}>
          <View style={{ position: 'absolute', right: -26, bottom: 46, opacity: 0.22 }}><Ionicons name="shield-checkmark" size={140} color={t.colors.onBrand} /></View>
          <View>
            <Txt style={{ color: t.colors.brandAccent, fontSize: 11, fontWeight: t.weight.bold as never, letterSpacing: 1.2, textTransform: 'uppercase' }}>{items.length ? 'Your Gear Vault' : 'Gear Vault · free'}</Txt>
            {items.length ? (
              <>
                <Txt style={{ color: t.colors.onBrand, fontSize: 24, fontWeight: t.weight.bold as never, letterSpacing: -0.6, marginTop: 12 }}>~{money(worth)}</Txt>
                <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.xs, marginTop: 4 }}>{items.length} {items.length === 1 ? 'item' : 'items'} · {insured ? `${insured} insured` : 'none insured yet'}</Txt>
              </>
            ) : (
              <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xl, fontWeight: t.weight.bold as never, marginTop: 12 }}>What is your kit worth today?</Txt>
            )}
          </View>
          <Pill label={items.length ? 'Open vault' : 'Add your gear'} small onPress={() => navigation.navigate('Vault')} />
        </Pressable>
        <View style={{ flex: 1, gap: 12 }}>
          {best
            ? small('Upgrading?', `Your ${best.modelLabel} could fetch ~${money(best.valuation!.midMinor)}`, () => navigation.navigate('Sell'))
            : small('Sell with us', 'We inspect, price and sell it for you', () => navigation.navigate('Sell'))}
          {small(seller ? 'Your selling' : 'Selling', seller ? 'Track your items and payouts' : 'Paid to your bank once the buyer keeps it', () => navigation.navigate('Sell'))}
        </View>
      </View>
    </View>
  )
}

function SoldCard({ s, t, img }: { s: HomeSale; t: Theme; img: string | null }) {
  return (
    <View style={{ width: 132, opacity: 0.92 }}>
      <View>
        <GearArt uri={img} brand={null} width={132} height={110} lens={/\d+mm\b|f\/\d/i.test(s.title)} icon={34} />
        <PhotoBadge label="Sold" />
      </View>
      <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never, marginTop: 8 }}>{s.title.split('·')[0].trim()}</Txt>
      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{s.gradeCode} · {money(s.priceMinor)}</Txt>
    </View>
  )
}
