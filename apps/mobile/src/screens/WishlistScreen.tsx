import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, ApiError, dateOnly, money, useApi, type BuyerAsk, type MyRequest, type Theme } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Field } from '../components/form'
import { ErrorNote, Loading } from '../components/ui'
import { Chip, GearArt, PageTitle, Pill, lift } from '../components/kit'
import { BottomSheet } from '../components/BottomSheet'
import { sizedUri } from '../components/ModelImage'

const LIVE = ['submitted', 'published']
const ENDED: Record<string, string> = {
  fulfilled: 'Found', rejected: 'Not accepted', withdrawn: 'Removed', expired: 'Expired',
}

/**
 * The buyer's wishlist (TG-117): gear they want that is not in the shop yet.
 * Each wish is a card with the model's picture and where it stands; a match
 * turns the card's foot green and takes them straight to it. Two at a time,
 * shown as two slots so the limit explains itself.
 */
export function WishlistScreen() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const mine = useApi(() => api.myRequests(), [])
  const home = useApi(() => api.buyerHome(), [])
  const images = useApi(() => api.modelImages(), [])
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [showEarlier, setShowEarlier] = useState(false)

  const asks = useMemo(() => new Map<string, BuyerAsk>((home.data?.asks ?? []).map((a) => [a.id, a])), [home.data])
  const img = useMemo(() => new Map((images.data?.models ?? []).map((m) => [m.slug, sizedUri(m.image, 300)])), [images.data])
  const data = mine.data
  // A wish past its date is over even if the nightly sweep has not marked it yet.
  const lapsed = (r: MyRequest) => !!r.expiresAt && new Date(r.expiresAt).getTime() < Date.now()
  const live = (data?.requests ?? []).filter((r) => LIVE.includes(r.state) && !lapsed(r))
  const earlier = (data?.requests ?? []).filter((r) => !LIVE.includes(r.state) || lapsed(r))

  const reload = () => { mine.reload(); home.reload() }
  const remove = (r: MyRequest) => Alert.alert('Remove this wish?', r.wanted, [
    { text: 'Keep it', style: 'cancel' },
    {
      text: 'Remove', style: 'destructive', onPress: async () => {
        setBusy(r.id)
        try { await api.withdrawRequest(r.id); reload() }
        catch (e) { Alert.alert('Could not remove it', (e as Error).message) }
        finally { setBusy(null) }
      },
    },
  ])

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: t.space.x7, gap: t.space.x4 }}>
        <PageTitle title="Wishlist" sub="Gear you're waiting for. We tell you the moment it's in."
          back={navigation.canGoBack() ? () => navigation.goBack() : undefined} />

        <View style={{ paddingHorizontal: t.space.x4, gap: 14 }}>
          {mine.error && <ErrorNote error={mine.error} onRetry={mine.reload} />}
          {mine.loading && !data && <Loading />}

          {data && live.length === 0 && <EmptyHero t={t} onAdd={() => setAdding(true)} />}

          {live.map((r) => {
            const a = asks.get(r.id)
            const slug = a?.modelSlug ?? guessSlug(r.wanted, img)
            return (
              <WishCard key={r.id} t={t} r={r} ask={a} uri={slug ? img.get(slug) ?? null : null} busy={busy === r.id}
                onRemove={() => remove(r)}
                onShop={(q) => navigation.navigate('Shop', { q, at: Date.now() })} />
            )
          })}

          {data && live.length > 0 && (data.slotsLeft > 0
            ? <AddSlot t={t} left={data.slotsLeft} limit={data.limit} days={data.expiryDays} onPress={() => setAdding(true)} />
            : (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}>
                <Ionicons name="information-circle-outline" size={16} color={t.colors.textMuted} />
                <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>Both wishes in use. Remove one to add another.</Txt>
              </View>
            ))}

          {earlier.length > 0 && (
            <View style={{ marginTop: t.space.x2 }}>
              <Pressable onPress={() => setShowEarlier((v) => !v)} accessibilityRole="button" hitSlop={8}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>Earlier wishes · {earlier.length}</Txt>
                <Ionicons name={showEarlier ? 'chevron-up' : 'chevron-down'} size={18} color={t.colors.textMuted} />
              </Pressable>
              {showEarlier && (
                <View style={{ backgroundColor: t.colors.bgRaised, borderRadius: 16, paddingHorizontal: 14 }}>
                  {earlier.map((r, i) => (
                    <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: i === earlier.length - 1 ? 0 : 1, borderBottomColor: t.colors.border }}>
                      <Ionicons name={r.state === 'fulfilled' ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={r.state === 'fulfilled' ? t.colors.good : t.colors.textMuted} />
                      <Txt numberOfLines={1} style={{ color: t.colors.text, flex: 1 }}>{r.wanted}</Txt>
                      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{LIVE.includes(r.state) ? 'Expired' : ENDED[r.state] ?? r.state}</Txt>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {adding && data && (
        <AddSheet t={t} days={data.expiryDays} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload() }} />
      )}
    </View>
  )
}

/**
 * A typed wish ("Panasonic Lumix S5 II body") has no catalogue link, so find
 * the model whose slug words all appear in it, longest first, for its picture.
 */
function guessSlug(wanted: string, img: Map<string, unknown>): string | null {
  const words = new Set(wanted.toLowerCase().replace(/[^a-z0-9.]+/g, ' ').split(' ').filter(Boolean))
  let best: string | null = null
  for (const slug of img.keys()) {
    const parts = slug.split('-')
    if (parts.length >= 2 && parts.every((w) => words.has(w)) && (!best || slug.length > best.length)) best = slug
  }
  return best
}

/** One wish: picture, what and at what price, where it stands, and the way to it. */
function WishCard({ t, r, ask, uri, busy, onRemove, onShop }: {
  t: Theme; r: MyRequest; ask?: BuyerAsk; uri: string | null; busy: boolean
  onRemove: () => void; onShop: (q: string) => void
}) {
  const checking = r.state === 'submitted'
  const found = (ask?.matchCount ?? 0) > 0
  const near = (ask?.nearCount ?? 0) > 0
  const from = ask && ask.matches.length ? Math.min(...ask.matches.map((m) => m.priceMinor)) : 0
  const lens = /\d+mm\b|f\/\d/i.test(r.wanted)

  return (
    <View style={[{ backgroundColor: t.colors.bgRaised, borderRadius: 20, overflow: 'hidden' }, lift(t)]}>
      <View style={{ flexDirection: 'row', gap: 14, padding: 14 }}>
        <GearArt uri={uri} width={84} height={84} radius={14} icon={30} lens={lens} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <Txt numberOfLines={2} style={{ flex: 1, color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never, lineHeight: 21 }}>{r.wanted}</Txt>
            <Pressable onPress={onRemove} disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${r.wanted}`}
              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.colors.bgSunken, alignItems: 'center', justifyContent: 'center', marginTop: -2 }}>
              {busy ? <ActivityIndicator size="small" color={t.colors.textMuted} /> : <Ionicons name="close" size={16} color={t.colors.textMuted} />}
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Tag t={t} icon="pricetag-outline" label={r.maxPriceMinor ? `Up to ${money(r.maxPriceMinor)}` : 'Any price'} />
            <Tag t={t} icon="ribbon-outline" label={r.minGradeLabel ? `${r.minGradeLabel}+` : 'Any condition'} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: checking ? t.colors.warn : t.colors.good }} />
            <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>
              {checking ? 'Being checked · usually within a day' : `Watching${r.expiresAt ? ` till ${dateOnly(r.expiresAt)}` : ''}`}
            </Txt>
          </View>
        </View>
      </View>

      {found ? (
        <Pressable onPress={() => onShop(ask!.matches[0]?.title ?? r.wanted)} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.colors.good, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Ionicons name="sparkles" size={18} color={t.colors.bg} />
          <Txt style={{ flex: 1, color: t.colors.bg, fontWeight: t.weight.bold as never }}>
            {ask!.matchCount} in stock{from ? ` · from ${money(from)}` : ''}
          </Txt>
          <Txt style={{ color: t.colors.bg, fontWeight: t.weight.bold as never }}>View</Txt>
          <Ionicons name="arrow-forward" size={16} color={t.colors.bg} />
        </Pressable>
      ) : near ? (
        <Pressable onPress={() => onShop(r.wanted)} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.colors.bgSunken, paddingVertical: 11, paddingHorizontal: 14 }}>
          <Ionicons name="eye-outline" size={17} color={t.colors.text} />
          <Txt style={{ flex: 1, color: t.colors.text, fontSize: t.size.sm }}>{ask!.nearCount} in stock above your price or below your condition</Txt>
          <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} />
        </Pressable>
      ) : !checking ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.colors.bgSunken, paddingVertical: 11, paddingHorizontal: 14 }}>
          <Ionicons name="notifications-outline" size={17} color={t.colors.textMuted} />
          <Txt style={{ flex: 1, color: t.colors.textMuted, fontSize: t.size.sm }}>Not in stock yet. We'll notify you.</Txt>
        </View>
      ) : null}
    </View>
  )
}

function Tag({ t, icon, label }: { t: Theme; icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.colors.bgSunken, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 9 }}>
      <Ionicons name={icon} size={12} color={t.colors.textMuted} />
      <Txt style={{ color: t.colors.text, fontSize: t.size.xs }}>{label}</Txt>
    </View>
  )
}

/** The free slot, drawn as an empty card so the two-at-a-time limit is visible, not explained. */
function AddSlot({ t, left, limit, days, onPress }: { t: Theme; left: number; limit: number; days: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Add a wish"
      style={{ borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.colors.borderStrong, paddingVertical: 18, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.colors.cta, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="add" size={26} color={t.colors.onCta} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>Add a wish</Txt>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{left} of {limit} free · each lasts {days} days</Txt>
      </View>
    </Pressable>
  )
}

function EmptyHero({ t, onAdd }: { t: Theme; onAdd: () => void }) {
  const steps: [React.ComponentProps<typeof Ionicons>['name'], string][] = [
    ['create-outline', 'Tell us the model and your price'],
    ['people-outline', 'Sellers see what buyers want'],
    ['notifications-outline', 'We alert you the moment it lands'],
  ]
  return (
    <View style={{ gap: t.space.x4 }}>
      <View style={[{ backgroundColor: t.colors.brand, borderRadius: 22, padding: 22, overflow: 'hidden', gap: 10 }, lift(t)]}>
        <View style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: t.colors.brandAlt, opacity: 0.6 }} />
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.colors.cta, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="heart" size={26} color={t.colors.onCta} />
        </View>
        <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>Can't find it in the shop?</Txt>
        <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm }}>Wish for it. You'll hear first when one comes in at your price.</Txt>
        <View style={{ marginTop: 6 }}><Pill label="Add your first wish" icon="add" onPress={onAdd} /></View>
      </View>
      <View style={{ gap: 12 }}>
        {steps.map(([icon, text], i) => (
          <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.bgRaised, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={icon} size={18} color={t.colors.cta} />
            </View>
            <Txt style={{ color: t.colors.text, flex: 1 }}><Txt style={{ color: t.colors.textMuted }}>{i + 1}. </Txt>{text}</Txt>
          </View>
        ))}
      </View>
    </View>
  )
}

function AddSheet({ t, days, onDone, onClose }: { t: Theme; days: number; onDone: () => void; onClose: () => void }) {
  const grades = useApi(() => api.grades(), [])
  const [wanted, setWanted] = useState('')
  const [price, setPrice] = useState('')
  const [grade, setGrade] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true); setError(null)
    try {
      await api.askFor({
        modelFreeText: wanted.trim(),
        minGradeCode: grade || null,
        maxPriceMinor: price ? Math.round(Number(price.replace(/[^\d.]/g, '')) * 100) : null,
        note: note.trim() || null,
      })
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add that')
    } finally { setBusy(false) }
  }

  return (
    <BottomSheet onClose={onClose} scroll
      header={<Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never, marginBottom: 8 }}>Add a wish</Txt>}
      footer={<Pill block label={busy ? 'Adding…' : 'Add to wishlist'} disabled={busy || wanted.trim().length < 3} onPress={save} />}>
      <Field label="What are you looking for?" value={wanted} onChangeText={setWanted} autoFocus
        placeholder="e.g. Sony 70-200mm f/2.8 GM II" hint={`Make and model is enough. It stays for ${days} days.`} />
      <Field label="Your top price (optional)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="₹" />
      <View style={{ gap: 8 }}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>Lowest condition you'd take</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Any" on={!grade} onPress={() => setGrade('')} />
          {(grades.data ?? []).filter((g) => g.isActive).map((g) => (
            <Chip key={g.code} label={g.label} on={grade === g.code} onPress={() => setGrade(g.code)} />
          ))}
        </View>
      </View>
      <Field label="Anything else (optional)" value={note} onChangeText={setNote} placeholder="e.g. must have the original box" />
      {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
    </BottomSheet>
  )
}
