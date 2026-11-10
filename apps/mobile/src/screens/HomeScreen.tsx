import { useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, isSeller, money, useApi, useSession, type BuyerHome, type HomeListing, type HomeSale, type Theme, type VaultItem } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Muted } from '../components/ui'
import { mediaUri, sizedUri } from '../components/ModelImage'

type IconName = React.ComponentProps<typeof Ionicons>['name']

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function HomeScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const { session } = useSession()
  const home = useApi(() => api.home(), [])
  const images = useApi(() => api.modelImages(), [])
  const notif = useApi(() => api.notifications(), [])
  // Signed in: their own tiles replace the sell pitch and the Buy / Sell toggle.
  const mine = useApi(() => (session ? api.buyerHome() : Promise.resolve(null)), [session?.userId])
  const vault = useApi(() => (session ? api.vault() : Promise.resolve(null)), [session?.userId])
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + t.space.x2, paddingBottom: t.space.x7, gap: t.space.x4 }}
      showsVerticalScrollIndicator={false}
    >
      {/* greeting header */}
      <View style={{ paddingHorizontal: t.space.x4, flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
        <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={6}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Txt style={{ color: t.colors.onBrand, fontWeight: t.weight.bold as never, fontSize: t.size.md }}>
            {(firstName ?? 'G').slice(0, 1).toUpperCase()}
          </Txt>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Muted size={t.size.sm}>{greeting()}</Muted>
          <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, letterSpacing: -0.3 }}>
            {firstName ?? 'Welcome'}
          </Txt>
        </View>
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="notifications-outline" size={21} color={t.colors.text} />
          {unread > 0 && (
            <View style={{ position: 'absolute', top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: t.colors.accent, borderWidth: 2, borderColor: t.colors.bgRaised }} />
          )}
        </Pressable>
      </View>

      {/* search + filter */}
      <View style={{ paddingHorizontal: t.space.x4, flexDirection: 'row', gap: t.space.x3 }}>
        <Pressable onPress={() => navigation.navigate('Shop')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space.x2, backgroundColor: t.colors.bgSunken, borderRadius: 15, paddingHorizontal: t.space.x4, height: 54 }}>
          <Ionicons name="search" size={18} color={t.colors.textMuted} />
          <Muted>Search camera, lens, or brand</Muted>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Shop', { openFilters: true, at: Date.now() })}
          accessibilityLabel="Filters"
          style={{ width: 54, height: 54, borderRadius: 15, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="options-outline" size={23} color={t.colors.onCta} />
        </Pressable>
      </View>

      {/* category circles */}
      {(d?.categories ?? []).length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x4 }}>
          {d!.categories.map((c) => (
            <Pressable key={c.slug ?? c.name}
              // A category, not a search term: the name ("Lenses") matches no listing title.
              // `at` makes a repeat tap of the same circle apply again.
              onPress={() => navigation.navigate('Shop', c.slug ? { category: c.slug, at: Date.now() } : { q: c.name, at: Date.now() })}
              style={{ alignItems: 'center', gap: 8, width: 66 }}>
              <View style={{
                width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.colors.bgRaised,
                borderWidth: 1, borderColor: t.colors.border,
              }}>
                <Ionicons name={categoryIcon(c.name)} size={25} color={t.colors.brand} />
              </View>
              <Txt numberOfLines={1} style={{ fontSize: t.size.xs, fontWeight: t.weight.medium as never, color: t.colors.textMuted }}>
                {c.name}
              </Txt>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {session ? (
        <>
          <Me t={t} b={mine.data ?? null} vault={vault.data ?? null} navigation={navigation} />
          {(d?.justIn ?? []).length > 0 && (
            <Section title="Just in" t={t} onSeeAll={() => navigation.navigate('Shop')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
                {d!.justIn.map((l) => <GearCard key={l.id} l={l} t={t} img={pic(l.cover, l.modelSlug)} onPress={() => navigation.navigate('Listing', { id: l.id })} />)}
              </ScrollView>
            </Section>
          )}
          {(d?.bestSavings ?? []).length > 0 && (
            <Section title="Biggest savings" t={t} onSeeAll={() => navigation.navigate('Shop')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
                {d!.bestSavings.map((l) => <GearCard key={l.id} l={l} t={t} img={pic(l.cover, l.modelSlug)} onPress={() => navigation.navigate('Listing', { id: l.id })} />)}
              </ScrollView>
            </Section>
          )}
          {(d?.recentlySold ?? []).length > 0 && (
            <Section title="Recently sold" t={t}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
                {d!.recentlySold.map((s) => <SoldCard key={s.id} s={s} t={t} img={pic(s.cover, s.modelSlug)} />)}
              </ScrollView>
            </Section>
          )}
        </>
      ) : (
        <>
          {/* sell hero */}
          <View style={{ paddingHorizontal: t.space.x4 }}>
            <View style={{ backgroundColor: t.colors.brand, borderRadius: 22, padding: t.space.x5, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', right: -40, top: -36, width: 180, height: 180, borderRadius: 90, backgroundColor: '#ffffff12' }} />
              <View style={{ position: 'absolute', right: 20, bottom: 18, opacity: 0.9 }}>
                <Ionicons name="camera" size={78} color={t.colors.brandAlt} />
                <View style={{ position: 'absolute', top: 30, left: 27, width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.accent }} />
              </View>
              <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xl, fontWeight: t.weight.bold as never, letterSpacing: -0.4, maxWidth: 210 }}>
                Sell your gear, get paid
              </Txt>
              <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm, marginTop: 7, maxWidth: 200 }}>
                Free pickup, honest grading &amp; fast payout
              </Txt>
              <Pressable onPress={() => navigation.navigate('Sell')}
                style={{ alignSelf: 'flex-start', marginTop: t.space.x4, backgroundColor: t.colors.cta, borderRadius: 14, paddingVertical: t.space.x3, paddingHorizontal: t.space.x5 }}>
                <Txt style={{ color: t.colors.onCta, fontWeight: t.weight.bold as never }}>
                  {isSeller(session) ? 'Open my selling' : 'Start selling'}
                </Txt>
              </Pressable>
            </View>
          </View>

          {/* buy / sell toggle */}
          <View style={{ paddingHorizontal: t.space.x4, flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
            <View style={{ flexDirection: 'row', backgroundColor: t.colors.bgSunken, borderRadius: 14, padding: 4 }}>
              {(['buy', 'sell'] as const).map((k) => (
                <Pressable key={k} onPress={() => setTab(k)}
                  style={{ paddingVertical: 9, paddingHorizontal: 22, borderRadius: 11, backgroundColor: tab === k ? t.colors.accent : 'transparent' }}>
                  <Txt style={{ fontWeight: t.weight.bold as never, fontSize: t.size.sm, color: tab === k ? t.colors.onCta : t.colors.textMuted }}>
                    {k === 'buy' ? 'Buy' : 'Sell'}
                  </Txt>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => navigation.navigate('Shop', { openFilters: true, at: Date.now() })} hitSlop={6}
              style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 15 }}>
              <Ionicons name="swap-vertical-outline" size={16} color={t.colors.text} />
              <Txt style={{ fontWeight: t.weight.bold as never, fontSize: t.size.sm }}>Sort</Txt>
            </Pressable>
          </View>

          {tab === 'buy' ? (
            <>
              {(d?.justIn ?? []).length > 0 && (
                <Section title="Featured gear" t={t} onSeeAll={() => navigation.navigate('Shop')}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
                    {d!.justIn.map((l) => <GearCard key={l.id} l={l} t={t} img={pic(l.cover, l.modelSlug)} onPress={() => navigation.navigate('Listing', { id: l.id })} />)}
                  </ScrollView>
                </Section>
              )}
              {(d?.bestSavings ?? []).length > 0 && (
                <Section title="Biggest savings" t={t} onSeeAll={() => navigation.navigate('Shop')}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
                    {d!.bestSavings.map((l) => <GearCard key={l.id} l={l} t={t} img={pic(l.cover, l.modelSlug)} onPress={() => navigation.navigate('Listing', { id: l.id })} />)}
                  </ScrollView>
                </Section>
              )}
              {(d?.recentlySold ?? []).length > 0 && (
                <Section title="Recently sold" t={t}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
                    {d!.recentlySold.map((s) => <SoldCard key={s.id} s={s} t={t} img={pic(s.cover, s.modelSlug)} />)}
                  </ScrollView>
                </Section>
              )}
            </>
          ) : (
            <View style={{ paddingHorizontal: t.space.x4 }}>
              <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 18, padding: t.space.x5, gap: t.space.x3 }}>
                <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="cash-outline" size={23} color={t.colors.accent} />
                </View>
                <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>
                  {isSeller(session) ? 'Selling with TrueGlaz' : 'Turn your gear into cash'}
                </Txt>
                <Muted size={t.size.sm}>
                  {isSeller(session)
                    ? 'Track your consignments, prices and payouts in one place.'
                    : 'Free pickup, we inspect & grade honestly, list it, and pay you when it sells.'}
                </Muted>
                <Pressable onPress={() => navigation.navigate('Sell')}
                  style={{ marginTop: t.space.x1, alignSelf: 'flex-start', backgroundColor: t.colors.cta, borderRadius: 13, paddingVertical: t.space.x3, paddingHorizontal: t.space.x5 }}>
                  <Txt style={{ color: t.colors.onCta, fontWeight: t.weight.bold as never }}>{isSeller(session) ? 'Open my selling' : 'Start selling'}</Txt>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

/**
 * A signed-in person's top of the screen, the same as the website: no order
 * details (those are in Orders), a count only when something is on its way,
 * and three tiles, each one reason to act today with one button:
 * - what they asked for is in stock (else: search the shop);
 * - what their kit is worth (else: add it to the vault);
 * - what their most valuable item could sell for (left out if nothing is valued).
 */
function Me({ t, b, vault, navigation }: { t: Theme; b: BuyerHome | null; vault: VaultItem[] | null; navigation: any }) {
  const onTheWay = b?.stats.inProgress ?? 0
  const ask = b?.asks.find((a) => (a.matchCount ?? 0) > 0) ?? null
  const items = vault ?? []
  const worth = items.reduce((n, i) => n + (i.valuation?.midMinor ?? i.costMinor ?? 0), 0)
  const insured = items.filter((i) => i.policy).length
  const best = [...items].filter((i) => i.valuation).sort((x, y) => y.valuation!.midMinor - x.valuation!.midMinor)[0] ?? null

  const tile = (navy: boolean) => ({
    borderRadius: 22, padding: t.space.x5, gap: 10, overflow: 'hidden' as const,
    backgroundColor: navy ? t.colors.brand : t.colors.bgRaised,
    borderWidth: navy ? 0 : 1, borderColor: t.colors.border,
  })
  const kicker = (navy: boolean) => ({ fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: navy ? t.colors.brandAccent : t.colors.accent })
  const title = (navy: boolean) => ({ fontSize: t.size.xl, fontWeight: t.weight.bold as never, letterSpacing: -0.3, color: navy ? t.colors.onBrand : t.colors.text })
  const primary = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={{ alignSelf: 'flex-start', marginTop: 4, backgroundColor: t.colors.cta, borderRadius: 14, paddingVertical: t.space.x3, paddingHorizontal: t.space.x5 }}>
      <Txt style={{ color: t.colors.onCta, fontWeight: t.weight.bold as never }}>{label}</Txt>
    </Pressable>
  )
  const secondary = (label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={{ alignSelf: 'flex-start', marginTop: 4, borderWidth: 1.5, borderColor: t.colors.cta, borderRadius: 14, paddingVertical: t.space.x3, paddingHorizontal: t.space.x5 }}>
      <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{label}</Txt>
    </Pressable>
  )

  return (
    <View style={{ paddingHorizontal: t.space.x4, gap: t.space.x3 }}>
      {onTheWay > 0 && (
        <Pressable onPress={() => navigation.navigate('Orders')} accessibilityRole="link"
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.pill, paddingVertical: 8, paddingHorizontal: 14 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.good }} />
          <Txt style={{ fontSize: t.size.sm, color: t.colors.text }}>
            <Txt style={{ fontWeight: t.weight.bold as never }}>{onTheWay}</Txt> {onTheWay === 1 ? 'order' : 'orders'} on the way · Track
          </Txt>
        </Pressable>
      )}

      {ask ? (
        <View style={tile(true)}>
          <Txt style={kicker(true)}>Matches your request</Txt>
          <Txt style={title(true)}>The {ask.matches[0]?.title ?? ask.wanted} you asked for: {ask.matchCount} in stock at your price</Txt>
          {ask.matches.slice(0, 2).map((m) => (
            <Pressable key={m.listingId} onPress={() => navigation.navigate('Listing', { id: m.listingId })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff17', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 }}>
              <View style={{ backgroundColor: '#ffffff26', borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 }}>
                <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xs }}>{m.gradeCode}</Txt>
              </View>
              <Txt numberOfLines={1} style={{ flex: 1, color: t.colors.onBrand, fontSize: t.size.sm }}>{m.title}</Txt>
              <Txt style={{ color: t.colors.onBrand, fontWeight: t.weight.bold as never, fontSize: t.size.sm }}>{money(m.priceMinor)}</Txt>
            </Pressable>
          ))}
          {primary('See matches', () => navigation.navigate('Shop', { q: ask.matches[0]?.title ?? ask.wanted, at: Date.now() }))}
        </View>
      ) : (
        <View style={tile(true)}>
          <Txt style={kicker(true)}>Just in</Txt>
          <Txt style={title(true)}>Fresh off the inspection bench, graded and ready to ship</Txt>
          {primary('Shop new arrivals', () => navigation.navigate('Shop'))}
        </View>
      )}

      {items.length > 0 ? (
        <View style={tile(false)}>
          <Txt style={kicker(false)}>Your Gear Vault</Txt>
          <Txt style={{ fontSize: 34, fontWeight: t.weight.bold as never, letterSpacing: -1, color: t.colors.text }}>~{money(worth)}</Txt>
          <Muted size={t.size.sm}>{items.length} {items.length === 1 ? 'item' : 'items'} · {insured ? `${insured} insured` : 'none insured yet'} · valued from real sales</Muted>
          {secondary('Open your vault', () => navigation.navigate('Vault'))}
        </View>
      ) : (
        <View style={tile(false)}>
          <Txt style={kicker(false)}>Gear Vault · free</Txt>
          <Txt style={title(false)}>What is your kit worth today?</Txt>
          <Muted size={t.size.sm}>Add what you own. We value it from real sales, and you can insure it.</Muted>
          {secondary('Add your gear', () => navigation.navigate('Vault'))}
        </View>
      )}

      {best && (
        <View style={tile(false)}>
          <Txt style={kicker(false)}>Upgrading?</Txt>
          <Txt style={title(false)}>Your {best.modelLabel} could fetch ~{money(best.valuation!.midMinor)}</Txt>
          <Muted size={t.size.sm}>We inspect it, price it and sell it. Paid to your bank once the buyer keeps it.</Muted>
          {secondary('Sell it with us', () => navigation.navigate('Sell'))}
        </View>
      )}
    </View>
  )
}

function Section({ title, t, onSeeAll, children }: { title: string; t: Theme; onSeeAll?: () => void; children: React.ReactNode }) {
  return (
    <View style={{ gap: t.space.x3 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: t.space.x4 }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, letterSpacing: -0.3 }}>{title}</Txt>
        {onSeeAll && <Pressable onPress={onSeeAll} hitSlop={8}><Txt style={{ color: t.colors.accent, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>See all</Txt></Pressable>}
      </View>
      {children}
    </View>
  )
}

/** A featured gear card in the new layout: image with inspected badge, price, grade chip. */
function GearCard({ l, t, img, onPress }: { l: HomeListing; t: Theme; img: string | null; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: 250 }}>
      <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 20, overflow: 'hidden' }}>
        <View style={{ height: 150, backgroundColor: img ? '#ffffff' : t.colors.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
          {img
            ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            : <Ionicons name="camera-outline" size={44} color={t.colors.textMuted} />}
          <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(26,46,59,0.74)', borderRadius: 9, paddingVertical: 5, paddingHorizontal: 10 }}>
            <Ionicons name="checkmark-circle" size={13} color="#fff" />
            <Txt style={{ color: '#fff', fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>Inspected</Txt>
          </View>
        </View>
        <View style={{ padding: t.space.x4, gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, letterSpacing: -0.4 }}>{money(l.priceMinor)}</Txt>
            <View style={{ marginLeft: 'auto', backgroundColor: t.colors.goodSoft, borderRadius: t.radius.pill, paddingVertical: 4, paddingHorizontal: 11 }}>
              <Txt style={{ color: t.colors.good, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>Grade {l.gradeCode}</Txt>
            </View>
          </View>
          <Txt numberOfLines={1} style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{l.title.split('·')[0].trim()}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3, marginTop: 4, paddingTop: 11, borderTopWidth: 1, borderTopColor: t.colors.border }}>
            {l.brandName && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="pricetag-outline" size={14} color={t.colors.textMuted} />
                <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{l.brandName}</Txt>
              </View>
            )}
            {l.savedPct != null && l.savedPct > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="trending-down-outline" size={14} color={t.colors.good} />
                <Txt style={{ color: t.colors.good, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>Save {l.savedPct}%</Txt>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  )
}

function SoldCard({ s, t, img }: { s: HomeSale; t: Theme; img: string | null }) {
  return (
    <View style={{ width: 150, opacity: 0.94 }}>
      <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 18, overflow: 'hidden' }}>
        <View style={{ height: 104, backgroundColor: img ? '#ffffff' : t.colors.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
          {img
            ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            : <Ionicons name="camera-outline" size={28} color={t.colors.textMuted} />}
          <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(26,46,59,0.74)', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 9 }}>
            <Txt style={{ color: '#fff', fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>Sold</Txt>
          </View>
        </View>
        <View style={{ padding: t.space.x3, gap: 2 }}>
          <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{s.title.split('·')[0].trim()}</Txt>
          <Muted size={t.size.xs}>{money(s.priceMinor)}</Muted>
        </View>
      </View>
    </View>
  )
}

function categoryIcon(name: string): IconName {
  const n = name.toLowerCase()
  if (n.includes('lens')) return 'ellipse-outline'
  if (n.includes('camera') || n.includes('body')) return 'camera-outline'
  if (n.includes('accessor')) return 'construct-outline'
  if (n.includes('light') || n.includes('flash')) return 'flash-outline'
  if (n.includes('drone')) return 'airplane-outline'
  if (n.includes('audio') || n.includes('mic')) return 'mic-outline'
  if (n.includes('tripod') || n.includes('support')) return 'git-commit-outline'
  return 'pricetag-outline'
}
