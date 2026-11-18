import { useEffect, useMemo, useState } from 'react'
import { confirm, notify } from '../components/Confirm'
import { VaultIntro } from './VaultIntro'
import { Animated, FlatList, Pressable, RefreshControl, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  api, money, dateOnly, useApi, ApiError,
  type VaultItem, type ProductModel,
} from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { PageTitle, Pill, RoundIcon, Surface } from '../components/kit'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Empty, ErrorNote, Loading, Muted } from '../components/ui'
import { ClaimSheet, CoverRow, PolicySheet, QuoteSheet, Sheet } from '../components/VaultCover'
import { ModelThumb, useModelImages } from '../components/ModelImage'
import { FadeIn, Pop, statusKey, useCountUp, useFill, useStatusChange } from '../components/motion'
import { InsureBanner } from '../components/InsureBanner'

/** The midpoint estimate, or the purchase cost when there is no valuation yet. */
function estimate(it: VaultItem): number {
  return it.valuation?.midMinor ?? it.costMinor ?? 0
}


const WARRANTY_LABEL: Record<VaultItem['warrantyStatus'], string> = {
  active: 'Under warranty', expiring: 'Warranty ending soon', expired: 'Warranty expired', unknown: 'Warranty unknown',
}

export function VaultScreen() {
  const t = useTheme()
  const pictures = useModelImages()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi(() => api.vault(), [])
  const [adding, setAdding] = useState(false)
  const [insuring, setInsuring] = useState<{ item: VaultItem; what: 'quote' | 'policy' | 'claim' } | null>(null)
  // Opened with a quote to start (a link from elsewhere): straight into that item's quote.
  const route = useRoute<any>()
  const nav = useNavigation<any>()
  const quoteFor: string | undefined = route.params?.quoteFor
  useEffect(() => {
    if (!quoteFor || !data) return
    const it = data.find((i) => i.id === quoteFor)
    if (it) setInsuring({ item: it, what: 'quote' })
    nav.setParams({ quoteFor: undefined })
  }, [quoteFor, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = data ?? []
  const total = useMemo(() => items.reduce((n, it) => n + estimate(it), 0), [items])
  const insured = items.filter((i) => i.policy).length
  // Asked for a quote or sent a policy: say so, not "0 insured".
  const issuing = items.filter((i) => !i.policy && i.insuranceRequest).length
  // TG-121: the value counts up and the insured share fills, rather than appearing.
  const shownTotal = useCountUp(total)
  const coverFill = useFill(350, 600, [insured, items.length])

  async function remove(item: VaultItem) {
    if (!(await confirm({ title: 'Remove from your vault?', message: `${item.modelLabel} and its details will be removed.`, confirmLabel: 'Remove', destructive: true }))) return
    try { await api.removeGear(item.id); reload() }
    catch (e) { notify('Could not remove it', e instanceof ApiError ? e.message : 'Please try again') }
  }

  const warrantyTone = (s: VaultItem['warrantyStatus']) =>
    s === 'active' ? { fg: t.colors.good, bg: t.colors.goodSoft }
      : s === 'expiring' ? { fg: t.colors.warn, bg: t.colors.warnSoft }
      : { fg: t.colors.textMuted, bg: t.colors.bgSunken }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <PageTitle title="Gear Vault" sub="What you own, valued from real sales." />
      <View style={{ height: t.space.x3 }} />


      {loading && !data && <Loading />}
      {error && <View style={{ padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>}

      {data && (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={t.colors.accent} />}
          contentContainerStyle={{ padding: t.space.x4, gap: t.space.x3, paddingBottom: insets.bottom + t.space.x6 }}
          ListHeaderComponent={items.length > 0 ? (
            <View style={{ gap: t.space.x3, marginBottom: t.space.x3 }}>
            <FadeIn>
            <View style={{ backgroundColor: t.colors.brand, borderRadius: 14, padding: t.space.x5, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', right: -28, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: '#ffffff10' }} />
              <View style={{ position: 'absolute', right: t.space.x4, top: t.space.x4 }}>
                <Ionicons name="shield-checkmark-outline" size={30} color="#ffffff33" />
              </View>
              <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm, fontWeight: t.weight.medium as never }}>Estimated market value</Txt>
              <Txt style={{ color: t.colors.onBrand, fontSize: 34, fontWeight: t.weight.bold as never, letterSpacing: -1, marginTop: 2 }}>~{money(Math.round(shownTotal / 100) * 100)}</Txt>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 10, overflow: 'hidden' }}>
                <Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.good,
                  width: coverFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.round((insured / items.length) * 100)}%`] }) }} />
              </View>
              <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.xs, marginTop: 7 }}>
                {items.length} item{items.length === 1 ? '' : 's'} · {coverNote(insured, issuing)} · indicative, final price set at a free inspection
              </Txt>
            </View>
            </FadeIn>
            <FadeIn delay={120}>
              <InsureBanner t={t} gear={items} onQuote={(id) => { const it = items.find((i) => i.id === id); if (it) setInsuring({ item: it, what: 'quote' }) }} />
            </FadeIn>
            </View>
          ) : undefined}
          ListEmptyComponent={
            <View style={{ gap: t.space.x3 }}>
              <Empty title="Your vault is empty" hint="Add gear you own to track its value, warranty and insurance." />
              <Button label="+ Add your first item" variant="cta" onPress={() => setAdding(true)} />
            </View>
          }
          ListFooterComponent={items.length > 0 ? (
            <Button label="+ Add gear" variant="ghost" onPress={() => setAdding(true)} style={{ marginTop: t.space.x1 }} />
          ) : undefined}
          renderItem={({ item, index }) => {
            const cost = item.costMinor
            const serial = item.serial
            const estVal = item.valuation?.midMinor ?? cost ?? null
            const wt = warrantyTone(item.warrantyStatus)
            return (
              <FadeIn index={index} delay={200}>
              <Surface style={{ padding: t.space.x4 }}>
                <CoverChange id={item.id} item={item} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
                  <ModelThumb image={pictures.byId(item.productModelId)} size={72} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never, letterSpacing: -0.2 }}>{item.modelLabel}</Txt>
                    {cost != null || serial ? (
                      <Muted size={t.size.xs} style={{ marginTop: 2 }}>
                        {[cost != null ? `Bought ${money(cost)}` : null, item.purchaseDate ? dateOnly(item.purchaseDate) : null, serial ? `ser ••${serial.slice(-4)}` : null].filter(Boolean).join(' · ')}
                      </Muted>
                    ) : null}
                    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7, backgroundColor: wt.bg, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 9 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: wt.fg }} />
                      <Txt style={{ color: wt.fg, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>
                        {WARRANTY_LABEL[item.warrantyStatus]}{item.warrantyExpiry && item.warrantyStatus !== 'expired' ? ` · to ${dateOnly(item.warrantyExpiry)}` : ''}
                      </Txt>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, letterSpacing: -0.3 }}>
                      {estVal != null ? `~${money(estVal)}` : '…'}
                    </Txt>
                    <Muted size={t.size.xs}>est. value</Muted>
                  </View>
                </View>
                <CoverRow item={item} onChanged={reload}
                  onQuote={() => setInsuring({ item, what: 'quote' })}
                  onAddPolicy={() => setInsuring({ item, what: 'policy' })}
                  onClaimHelp={() => setInsuring({ item, what: 'claim' })} />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: t.space.x3 }}>
                  <RoundIcon icon="trash-outline" label={`Remove ${item.modelLabel}`} onPress={() => remove(item)} size={34} />
                </View>
              </Surface>
              </FadeIn>
            )
          }}
        />
      )}

      {adding && (
        <AddModal
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); reload() }}
        />
      )}
      {insuring?.what === 'quote' && <QuoteSheet item={insuring.item} onClose={() => setInsuring(null)} onDone={() => { setInsuring(null); reload() }} />}
      {insuring?.what === 'policy' && <PolicySheet item={insuring.item} onClose={() => setInsuring(null)} onDone={() => { setInsuring(null); reload() }} />}
      {insuring?.what === 'claim' && <ClaimSheet onClose={() => setInsuring(null)} />}
      {/* The Vault's own invitation lives here, not over Home or Shop (UX-02). */}
      <VaultIntro onClosed={reload} />
    </View>
  )
}

// -- add gear ------------------------------------------------------------------

function AddModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const t = useTheme()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ProductModel[]>([])
  const [model, setModel] = useState<ProductModel | null>(null)
  const [serial, setSerial] = useState('')
  const [cost, setCost] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function search(text: string) {
    setQ(text); setModel(null)
    if (text.trim().length < 2) { setResults([]); return }
    try { setResults((await api.searchModels(text.trim(), 8)).content) } catch { setResults([]) }
  }

  const costMinor = cost ? Math.round(parseFloat(cost) * 100) : null

  async function submit() {
    setBusy(true); setErr(null)
    try {
      await api.addGear({
        productModelId: model?.id ?? null,
        modelFreeText: model ? null : q.trim() || null,
        purchaseDate: date.trim() || null,
        serial: serial.trim() || null,
        costMinor,
      })
      onAdded()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not add that') } finally { setBusy(false) }
  }

  const canSave = (model != null || q.trim().length > 1) && !busy

  return (
    <Sheet title="Add gear" onClose={onClose}>
      <Field label="Model" placeholder="Search the catalogue, or type what it is"
        value={model ? model.name : q} onChangeText={search} autoFocus />
      {!model && results.length > 0 && (
        <View style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, overflow: 'hidden' }}>
          {results.map((m) => (
            <Pressable accessibilityRole="button" key={m.id} onPress={() => { setModel(m); setResults([]) }}
              style={{ paddingVertical: t.space.x3, paddingHorizontal: t.space.x3, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
              <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>{m.name}</Txt>
            </Pressable>
          ))}
        </View>
      )}
      <Field label="Serial number" placeholder="Kept private & sealed" value={serial} onChangeText={setSerial} />
      <Field label="What you paid (₹)" placeholder="e.g. 130000" keyboardType="numeric" value={cost} onChangeText={setCost} />
      <Field label="Purchase date (YYYY-MM-DD)" placeholder="2024-06-15" value={date} onChangeText={setDate} />
      <Muted size={t.size.xs}>We’ll estimate its value from our market and work out the warranty from the purchase date.</Muted>
      {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
      <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
        <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button label={busy ? 'Adding…' : 'Add to vault'} onPress={submit} disabled={!canSave} loading={busy} style={{ flex: 1 }} />
      </View>
    </Sheet>
  )
}

// -- bits ----------------------------------------------------------------------

/** "2 insured", "1 insured · 1 in progress", or "1 insurance request in progress". */
function coverNote(insured: number, open: number): string {
  if (open === 0) return `${insured} insured`
  if (insured > 0) return `${insured} insured · ${open} in progress`
  return `${open} insurance ${open === 1 ? 'request' : 'requests'} in progress`
}

/**
 * When an item's insurance moved on since this phone last showed it (quote in,
 * policy checked, insured), a small "Updated" chip pops in on the card, once.
 */
function CoverChange({ id, item }: { id: string; item: VaultItem }) {
  const t = useTheme()
  const now = item.policy ? 'insured' : item.insuranceRequest?.status ?? 'none'
  const moved = useStatusChange(`vault:${id}`, statusKey(now), 'commit')
  if (!moved.changed) return null
  const label = now === 'insured' ? 'Now insured' : now === 'quote_shared' ? 'Quote is in' : 'Insurance updated'
  return (
    <Pop delay={500} style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: now === 'insured' ? t.colors.goodSoft : t.colors.accentSoft, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 9 }}>
        <Ionicons name="sparkles" size={11} color={now === 'insured' ? t.colors.good : t.colors.accent} />
        <Txt style={{ color: now === 'insured' ? t.colors.good : t.colors.accentText, fontSize: 11, fontWeight: t.weight.bold as never }}>{label}</Txt>
      </View>
    </Pop>
  )
}
