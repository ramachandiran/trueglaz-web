import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  api, EMPTY_FILTERS, money, relative,
  useApi, activeFilterCount, singularCategory, type FacetOption, type Filters, type Listing,
  type SearchFacets, type SearchHit, type Sort,
} from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { mobileFontFamily } from '../theme/fonts'
import { useTheme } from '../theme/ThemeContext'
import { Empty, ErrorNote, Loading } from '../components/ui'
import { sizedUri } from '../components/ModelImage'

/**
 * Catalogue — a buyer-forward, B2B-marketplace card layout (image left, spec
 * rows right, a trust line, and an action row), kept entirely in the TrueGlaz
 * palette. Filtering, paging and the filter options come from /listings/search,
 * over the whole shop, so the sheet only offers choices that are in stock — the
 * same groups the website shows.
 */
const PAGE = 24

type ListKey = 'categoryIds' | 'brandIds' | 'mountIds' | 'lensTypes' | 'lensRanges' | 'sensorFormats' | 'grades'
const GROUPS: { key: ListKey; facet: keyof SearchFacets; title: string }[] = [
  { key: 'categoryIds', facet: 'category', title: 'Type' },
  { key: 'brandIds', facet: 'brand', title: 'Brand' },
  { key: 'mountIds', facet: 'mount', title: 'Mount' },
  { key: 'lensTypes', facet: 'lensType', title: 'Lens type' },
  { key: 'lensRanges', facet: 'lensRange', title: 'Focal range' },
  { key: 'sensorFormats', facet: 'sensorFormat', title: 'Sensor' },
  { key: 'grades', facet: 'grade', title: 'Condition' },
]
export function CatalogScreen({ navigation, route }: { navigation: any; route?: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)

  // What is typed reaches the search after a short pause, not on every key.
  const [typed, setTyped] = useState(filters.q)
  useEffect(() => {
    const id = setTimeout(() => setFilters((f) => (f.q === typed ? f : { ...f, q: typed })), 300)
    return () => clearTimeout(id)
  }, [typed])

  const key = JSON.stringify(filters)
  const search = useApi(() => api.searchListings(filters, 0, PAGE), [key])
  const grades = useApi(() => api.grades(), [])
  const brands = useApi(() => api.brands(), [])
  const categories = useApi(() => api.categories(), [])
  const images = useApi(() => api.modelImages(), [])

  // Home links in with a category, a search term or "open the filters". Shop is
  // a tab that stays mounted, so this runs on every visit that carries a request
  // (keyed on `at`), not just the first: a second category tap must apply too.
  const params = route?.params as { category?: string; q?: string; openFilters?: boolean; at?: number } | undefined
  const applied = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!params?.at || applied.current === params.at) return
    if (params.category && !categories.data) return // wait for the slug -> id lookup
    applied.current = params.at
    if (params.category || params.q !== undefined) {
      const cat = params.category ? categories.data?.find((c) => c.slug === params.category) : undefined
      const next = { ...EMPTY_FILTERS, sort: filters.sort, q: params.q ?? '', categoryIds: cat ? [cat.id] : [] }
      setTyped(next.q)
      setFilters(next)
    }
    if (params.openFilters) setSheetOpen(true)
  }, [params?.at, categories.data])

  // Further pages, appended as the list nears its end. Tagged with the search
  // they belong to, so a page that lands after the filters changed is dropped.
  const [more, setMore] = useState<{ key: string; hits: SearchHit[]; next: number }>({ key: '', hits: [], next: 1 })
  const [loadingMore, setLoadingMore] = useState(false)
  const latestKey = useRef(key)
  latestKey.current = key
  const extra = more.key === key ? more : { key, hits: [] as SearchHit[], next: 1 }
  const hits = [...(search.data?.hits ?? []), ...extra.hits]
  const total = search.data?.total ?? 0
  async function loadMore() {
    if (loadingMore || hits.length >= total) return
    const forKey = key
    setLoadingMore(true)
    try {
      const page = await api.searchListings(filters, extra.next, PAGE)
      if (latestKey.current === forKey) setMore({ key: forKey, hits: [...extra.hits, ...page.hits], next: extra.next + 1 })
    } catch { /* the next scroll tries again */ } finally { setLoadingMore(false) }
  }

  const gradeRank = useMemo(() => new Map((grades.data ?? []).map((g) => [g.code, g.rank])), [grades.data])
  const gradeLabel = useMemo(() => new Map((grades.data ?? []).map((g) => [g.code, g.label])), [grades.data])
  const brandName = useMemo(() => new Map((brands.data ?? []).map((b) => [b.id, b.name])), [brands.data])
  const categoryName = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.name])), [categories.data])
  const imageBySlug = useMemo(
    () => new Map((images.data?.models ?? []).map((m) => [m.slug, sizedUri(m.image, 400)])),
    [images.data],
  )

  const active = activeFilterCount(filters)
  const toggle = (key: ListKey, value: string) => {
    const list = filters[key]
    setFilters({ ...filters, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }
  const onlyCategory = (id: string | null) => setFilters({ ...filters, categoryIds: id ? [id] : [] })
  const activeCatId = filters.categoryIds.length === 1 ? filters.categoryIds[0] : null
  const crumb = activeCatId ? categoryName.get(activeCatId) ?? 'Gear' : 'All gear'

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', gap: t.space.x3, padding: t.space.x4, paddingBottom: t.space.x3 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space.x2, backgroundColor: t.colors.bgSunken, borderRadius: 15, paddingHorizontal: t.space.x4, height: 52 }}>
          <Ionicons name="search" size={18} color={t.colors.textMuted} />
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="Search cameras, lenses…"
            placeholderTextColor={t.colors.textMuted}
            style={{ flex: 1, color: t.colors.text, fontFamily: mobileFontFamily.regular, fontSize: 14 }}
          />
        </View>
        <Pressable onPress={() => setSheetOpen(true)}
          style={{ width: 52, height: 52, borderRadius: 15, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="options-outline" size={23} color={t.colors.onCta} />
          {active > 0 && (
            <View style={{ position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: t.colors.brand, borderWidth: 2, borderColor: t.colors.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Txt style={{ color: t.colors.onBrand, fontSize: 10, fontWeight: t.weight.bold as never }}>{active}</Txt>
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x2, alignItems: 'center' }}
        style={{ flexGrow: 0, flexShrink: 0, height: 52, marginBottom: t.space.x2 }}
      >
        <QuickChip label="All" selected={!activeCatId} onPress={() => onlyCategory(null)} />
        {(search.data?.facets.category ?? (categories.data ?? []).map((c) => ({ value: c.id, label: c.name, count: 0 }))).map((c) => (
          <QuickChip key={c.value} label={c.label} selected={activeCatId === c.value} onPress={() => onlyCategory(activeCatId === c.value ? null : c.value)} />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: t.space.x4, paddingBottom: t.space.x2 }}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>
          Used gear  ›  <Txt style={{ color: t.colors.text, fontWeight: t.weight.medium as never }}>{crumb}</Txt>
          {`   ·   ${total} ${total === 1 ? 'result' : 'results'}`}
        </Txt>
      </View>

      {search.loading && !search.data && <Loading />}
      {search.error && <View style={{ padding: t.space.x4 }}><ErrorNote error={search.error} onRetry={search.reload} /></View>}

      {search.data && !search.error && (
        <FlatList
          data={hits}
          keyExtractor={(r) => r.listing.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={loadingMore ? <Loading /> : undefined}
          contentContainerStyle={{ padding: t.space.x4, paddingTop: t.space.x1, gap: t.space.x3 }}
          ListEmptyComponent={<Empty title="Nothing matches those filters" hint="Try clearing one or widening the search." />}
          renderItem={({ item: { listing, modelSlug, brandId, categoryId, mine } }) => (
            <ListingCard
              listing={listing}
              image={modelSlug ? imageBySlug.get(modelSlug) : undefined}
              brand={brandId ? brandName.get(brandId) : undefined}
              category={categoryId ? categoryName.get(categoryId) : undefined}
              gradeText={gradeLabel.get(listing.gradeCode)}
              top={(gradeRank.get(listing.gradeCode) ?? 0) >= 9}
              mine={!!mine}
              onOpen={() => navigation.navigate('Listing', { id: listing.id })}
              onBuy={() => navigation.navigate('Checkout', {
                listingId: listing.id, title: listing.title.split('·')[0].trim(),
                priceMinor: listing.priceMinor, currency: listing.currency,
              })}
            />
          )}
        />
      )}

      <FilterSheet
        open={sheetOpen} onClose={() => setSheetOpen(false)}
        filters={filters} active={active}
        // Clearing the filters clears the search too; the box must say so (TG-12).
        setFilters={(f) => { setFilters(f); if (f.q !== typed) setTyped(f.q) }}
        facets={search.data?.facets ?? null} price={search.data?.price ?? null} total={total} toggle={toggle}
      />
    </View>
  )
}

function ListingCard({
  listing, image, brand, category, gradeText, top, mine, onOpen, onBuy,
}: {
  listing: Listing; image?: string
  brand?: string; category?: string; gradeText?: string; top: boolean; mine: boolean
  onOpen: () => void; onBuy: () => void
}) {
  const t = useTheme()
  const title = listing.title.split('·')[0].trim()
  return (
    <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 18, overflow: 'hidden' }}>
      <Pressable onPress={onOpen} style={{ flexDirection: 'row', gap: t.space.x3, padding: 13 }}>
        <View style={{ width: 100, height: 100, borderRadius: 13, overflow: 'hidden', backgroundColor: image ? '#ffffff' : t.colors.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
          {image
            ? <Image source={{ uri: image }} style={{ width: 100, height: 100 }} resizeMode="contain" />
            : <Ionicons name="camera-outline" size={34} color={t.colors.textMuted} />}
          <View style={{ position: 'absolute', top: 7, left: 7, backgroundColor: top ? t.colors.good : t.colors.accent, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8 }}>
            <Txt style={{ color: '#fff', fontSize: 10.5, fontWeight: t.weight.bold as never }}>{listing.gradeCode}</Txt>
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt numberOfLines={2} style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never, letterSpacing: -0.2, lineHeight: 19 }}>{title}</Txt>
          <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, letterSpacing: -0.4, marginTop: 4 }}>{money(listing.priceMinor, listing.currency)}</Txt>
          {(brand || category) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 }}>
              {brand && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{brand}</Txt>}
              {brand && category && <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: t.colors.textMuted }} />}
              {category && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{singularCategory(category)}</Txt>}
            </View>
          )}
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, backgroundColor: t.colors.goodSoft, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 9 }}>
            <Ionicons name="checkmark-circle" size={12} color={t.colors.good} />
            <Txt style={{ color: t.colors.good, fontSize: 11, fontWeight: t.weight.bold as never }}>Grade {listing.gradeCode}{gradeText ? ` · ${gradeText}` : ''}</Txt>
          </View>
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 11, borderTopWidth: 1, borderTopColor: t.colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="time-outline" size={13} color={t.colors.textMuted} />
          <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>
            {listing.publishedAt ? `Listed ${relative(listing.publishedAt)}` : 'Recently listed'}
          </Txt>
        </View>
        {mine ? (
          // A seller's own unit: they manage it from the listing page; buying it is refused.
          <Pressable onPress={onOpen} style={{ borderWidth: 1.5, borderColor: t.colors.accent, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 14 }}>
            <Txt style={{ color: t.colors.accent, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>Your listing · Manage</Txt>
          </Pressable>
        ) : (
          <Pressable onPress={onBuy} style={{ backgroundColor: t.colors.cta, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 18 }}>
            <Txt style={{ color: t.colors.onCta, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>Buy now</Txt>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function QuickChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress}
      style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: selected ? t.colors.accent : t.colors.bgRaised, borderColor: selected ? t.colors.accent : t.colors.border }}>
      <Txt style={{ color: selected ? t.colors.onAccent : t.colors.text, fontSize: t.size.sm }}>{label}</Txt>
    </Pressable>
  )
}

function FilterSheet({
  open, onClose, filters, setFilters, active, facets, price, total, toggle,
}: {
  open: boolean; onClose: () => void; filters: Filters; setFilters: (f: Filters) => void; active: number
  facets: SearchFacets | null; price: { minMinor: number; maxMinor: number } | null; total: number
  toggle: (key: ListKey, value: string) => void
}) {
  const t = useTheme()
  const rupees = (minor: number | null) => (minor === null ? '' : String(Math.round(minor / 100)))
  const fromRupees = (text: string) => (text.trim() === '' ? null : Math.max(0, Number(text.replace(/[^0-9]/g, '')) * 100))
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={{ backgroundColor: t.colors.bgRaised, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg, maxHeight: '85%', padding: t.space.x4 }}>
          <View style={styles.sheetHead}>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>Filters</Txt>
            <View style={{ flexDirection: 'row', gap: t.space.x3 }}>
              {active > 0 && (
                <Pressable onPress={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}>
                  <Txt style={{ color: t.colors.accent }}>Clear {active}</Txt>
                </Pressable>
              )}
              <Pressable onPress={onClose}><Txt style={{ color: t.colors.accent, fontWeight: t.weight.medium as never }}>Show {total}</Txt></Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ gap: t.space.x5, paddingBottom: t.space.x6 }}>
            <Group title="Sort">
              <Wrap>
                {([['newest', 'Newest'], ['price-asc', 'Price ↑'], ['price-desc', 'Price ↓'], ['grade-desc', 'Condition']] as [Sort, string][]).map(([value, label]) => (
                  <Chip key={value} label={label} selected={filters.sort === value} onPress={() => setFilters({ ...filters, sort: value })} />
                ))}
              </Wrap>
            </Group>
            {/* Only groups with stock behind them, from the search itself. */}
            {facets && GROUPS.map(({ key, facet, title }) => {
              const options: FacetOption[] = facets[facet]
              if (options.length === 0) return null
              return (
                <Group key={key} title={title}>
                  <Wrap>
                    {options.map((o) => (
                      <Chip key={o.value} label={`${o.label} ${o.count}`} selected={filters[key].includes(o.value)} onPress={() => toggle(key, o.value)} />
                    ))}
                  </Wrap>
                </Group>
              )
            })}
            <Group title="Price (₹)">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2 }}>
                <PriceField t={t} placeholder={price ? rupees(price.minMinor) : 'Min'} value={rupees(filters.minPriceMinor)}
                  onChange={(v) => setFilters({ ...filters, minPriceMinor: fromRupees(v) })} />
                <Txt style={{ color: t.colors.textMuted }}>–</Txt>
                <PriceField t={t} placeholder={price ? rupees(price.maxMinor) : 'Max'} value={rupees(filters.maxPriceMinor)}
                  onChange={(v) => setFilters({ ...filters, maxPriceMinor: fromRupees(v) })} />
              </View>
              {price && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{money(price.minMinor)} – {money(price.maxMinor)} in stock</Txt>}
            </Group>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function PriceField({ t, value, placeholder, onChange }: { t: ReturnType<typeof useTheme>; value: string; placeholder: string; onChange: (v: string) => void }) {
  // The box takes the share of the row; the input fills the box. A bare input
  // keeps its own intrinsic width, which pushed the second one off the sheet.
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder} keyboardType="number-pad"
        placeholderTextColor={t.colors.textMuted}
        style={{ width: '100%', height: 44, borderWidth: 1, borderColor: t.colors.border, borderRadius: 11, paddingHorizontal: t.space.x3, color: t.colors.text, fontFamily: mobileFontFamily.regular }}
      />
    </View>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme()
  return (
    <View style={{ gap: t.space.x2 }}>
      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.6 }}>{title.toUpperCase()}</Txt>
      {children}
    </View>
  )
}
function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
}
function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable onPress={disabled ? undefined : onPress}
      style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, opacity: disabled ? 0.4 : 1, backgroundColor: selected ? t.colors.accentSoft : t.colors.bg, borderColor: selected ? t.colors.accent : t.colors.border }}>
      <Txt style={{ color: selected ? t.colors.accent : t.colors.text, fontSize: t.size.sm }}>{label}</Txt>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
})
