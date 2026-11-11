import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  api, EMPTY_FILTERS, money,
  useApi, activeFilterCount, type FacetOption, type Filters,
  type SearchFacets, type SearchHit, type Sort,
} from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { BottomSheet } from '../components/BottomSheet'
import { mobileFontFamily } from '../theme/fonts'
import { useTheme } from '../theme/ThemeContext'
import { Empty, ErrorNote, Loading } from '../components/ui'
import { sizedUri } from '../components/ModelImage'
import { Chip as KitChip, ChipRow, PageTitle, ProductCard, lift } from '../components/kit'

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
  const { width } = useWindowDimensions()
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

  const sortLabel: Record<Sort, string> = { newest: 'Newest first', 'price-asc': 'Price: low to high', 'price-desc': 'Price: high to low', 'grade-desc': 'Best condition' }
  const cardW = Math.floor((width - 32 - 14) / 2)

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <PageTitle title="Shop" />

      {/* Search, as a pill on a shadow rather than a sunken box. */}
      <View style={[{ marginHorizontal: t.space.x4, marginTop: t.space.x3, flexDirection: 'row', alignItems: 'center', gap: t.space.x2,
        backgroundColor: t.colors.bgRaised, borderRadius: t.radius.pill, paddingHorizontal: t.space.x4, height: 48 }, lift(t)]}>
        <Ionicons name="search" size={18} color={t.colors.textMuted} />
        <TextInput
          value={typed}
          onChangeText={setTyped}
          placeholder="Search cameras, lenses…"
          placeholderTextColor={t.colors.textMuted}
          accessibilityLabel="Search the shop"
          style={{ flex: 1, color: t.colors.text, fontFamily: mobileFontFamily.regular, fontSize: 14 }}
        />
      </View>

      <View style={{ marginTop: t.space.x3 }}>
        <ChipRow>
          <KitChip label="All" on={!activeCatId} onPress={() => onlyCategory(null)} />
          {(search.data?.facets.category ?? (categories.data ?? []).map((c) => ({ value: c.id, label: c.name, count: 0 }))).map((c) => (
            <KitChip key={c.value} label={c.label} on={activeCatId === c.value} onPress={() => onlyCategory(activeCatId === c.value ? null : c.value)} />
          ))}
        </ChipRow>
      </View>

      {/* Filters · sort · how many, as one quiet row. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: t.space.x4, paddingVertical: t.space.x3 }}>
        <Pressable onPress={() => setSheetOpen(true)} accessibilityRole="button" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="filter" size={18} color={t.colors.text} />
          <Txt style={{ color: t.colors.text, fontSize: t.size.xs }}>Filters{active ? ` · ${active}` : ''}</Txt>
        </Pressable>
        <Pressable onPress={() => setSheetOpen(true)} accessibilityRole="button" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="swap-vertical" size={16} color={t.colors.text} />
          <Txt style={{ color: t.colors.text, fontSize: t.size.xs }}>{sortLabel[filters.sort]}</Txt>
        </Pressable>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{total} {total === 1 ? 'piece' : 'pieces'}</Txt>
      </View>

      {search.loading && !search.data && <Loading />}
      {search.error && <View style={{ padding: t.space.x4 }}><ErrorNote error={search.error} onRetry={search.reload} /></View>}

      {search.data && !search.error && (
        <FlatList
          data={hits}
          numColumns={2}
          keyExtractor={(r) => r.listing.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={loadingMore ? <Loading /> : undefined}
          columnWrapperStyle={{ gap: 14 }}
          contentContainerStyle={{ paddingHorizontal: t.space.x4, paddingTop: t.space.x1, paddingBottom: t.space.x6, gap: 22 }}
          ListEmptyComponent={<Empty title="Nothing matches those filters" hint="Try clearing one or widening the search." />}
          renderItem={({ item: { listing, modelSlug, brandId, categoryId, mine } }) => {
            const title = listing.title.split('·')[0].trim()
            const category = categoryId ? categoryName.get(categoryId) : undefined
            return (
              <ProductCard
                width={cardW}
                g={{ title: listing.title, gradeCode: listing.gradeCode, priceMinor: listing.priceMinor, brandName: brandId ? brandName.get(brandId) : null, categorySlug: category ?? null }}
                img={modelSlug ? imageBySlug.get(modelSlug) : undefined}
                onPress={() => navigation.navigate('Listing', { id: listing.id })}
                // A seller's own unit: they manage it from the listing page; buying it is refused.
                actionIcon={mine ? 'create-outline' : 'bag-handle-outline'}
                actionLabel={mine ? `Manage your ${title}` : `Buy ${title}`}
                onAction={mine
                  ? () => navigation.navigate('Listing', { id: listing.id })
                  : () => navigation.navigate('Checkout', { listingId: listing.id, title, priceMinor: listing.priceMinor, currency: listing.currency })}
              />
            )
          }}
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
    <BottomSheet visible={open} onClose={onClose} maxHeight="85%" scroll gap={t.space.x5} header={(
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
    )}>

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
    </BottomSheet>
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
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
})
