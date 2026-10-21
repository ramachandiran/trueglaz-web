import { useMemo, useState } from 'react'
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  api, applyFilters, buildModelIndex, countBy, EMPTY_FILTERS, money, resolveModel,
  useApi, activeFilterCount, singularCategory, type Facetable, type Filters, type Listing, type ProductModel, type Sort,
} from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { mobileFontFamily } from '../theme/fonts'
import { useTheme } from '../theme/ThemeContext'
import { Badge, Empty, ErrorNote, Loading, Muted } from '../components/ui'
import { API_ORIGIN } from '../config'

/**
 * Catalogue — a buyer-forward, B2B-marketplace card layout (image left, spec
 * rows right, a trust line, and an action row), kept entirely in the TrueGlaz
 * palette. The facets still open in a sheet; `applyFilters` does the filtering.
 */
export function CatalogScreen({ navigation, route }: { navigation: any; route?: any }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  // The Home screen can deep-link in with a search term (e.g. a category name).
  const [filters, setFilters] = useState<Filters>(
    route?.params?.q ? { ...EMPTY_FILTERS, q: route.params.q } : EMPTY_FILTERS,
  )
  const [sheetOpen, setSheetOpen] = useState(false)

  const listings = useApi(() => api.listings({ q: filters.q, size: 200 }), [filters.q])
  const models = useApi(() => api.models(), [])
  const grades = useApi(() => api.grades(), [])
  const brands = useApi(() => api.brands(), [])
  const categories = useApi(() => api.categories(), [])
  const images = useApi(() => api.modelImages(), [])

  const modelIndex = useMemo(() => buildModelIndex(models.data?.content ?? []), [models.data])
  const rows: Facetable[] = useMemo(
    () => (listings.data?.content ?? []).map((listing) => ({ listing, model: resolveModel(listing, modelIndex) })),
    [listings.data, modelIndex],
  )
  const gradeRank = useMemo(() => new Map((grades.data ?? []).map((g) => [g.code, g.rank])), [grades.data])
  const gradeLabel = useMemo(() => new Map((grades.data ?? []).map((g) => [g.code, g.label])), [grades.data])
  const brandName = useMemo(() => new Map((brands.data ?? []).map((b) => [b.id, b.name])), [brands.data])
  const categoryName = useMemo(() => new Map((categories.data ?? []).map((c) => [c.id, c.name])), [categories.data])
  const imageBySlug = useMemo(
    () => new Map((images.data?.models ?? []).map((m) => [m.slug, API_ORIGIN + m.image.url])),
    [images.data],
  )
  const visible = useMemo(() => applyFilters(rows, filters, gradeRank), [rows, filters, gradeRank])

  const counts = useMemo(
    () => ({
      category: countBy(applyFilters(rows, { ...filters, categoryIds: [] }, gradeRank), (r) => r.model?.categoryId),
      brand: countBy(applyFilters(rows, { ...filters, brandIds: [] }, gradeRank), (r) => r.model?.brandId),
      grade: countBy(applyFilters(rows, { ...filters, grades: [] }, gradeRank), (r) => r.listing.gradeCode),
    }),
    [rows, filters, gradeRank],
  )

  const active = activeFilterCount(filters)
  const toggle = (key: 'categoryIds' | 'brandIds' | 'grades', value: string) => {
    const list = filters[key]
    setFilters({ ...filters, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] })
  }
  const onlyCategory = (id: string | null) => setFilters({ ...filters, categoryIds: id ? [id] : [] })
  const activeCatId = filters.categoryIds.length === 1 ? filters.categoryIds[0] : null
  const crumb = activeCatId ? categoryName.get(activeCatId) ?? 'Gear' : 'All gear'

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <View style={[styles.bar, { padding: t.space.x4, paddingBottom: t.space.x3 }]}>
        <TextInput
          value={filters.q}
          onChangeText={(q) => setFilters({ ...filters, q })}
          placeholder="Search cameras, lenses…"
          placeholderTextColor={t.colors.textMuted}
          style={{
            flex: 1, color: t.colors.text, fontFamily: mobileFontFamily.regular,
            backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border,
            borderRadius: t.radius.md, paddingHorizontal: t.space.x3, paddingVertical: t.space.x2,
          }}
        />
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={{
            paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderRadius: t.radius.md,
            backgroundColor: active ? t.colors.accent : t.colors.bgRaised,
            borderWidth: 1, borderColor: active ? t.colors.accent : t.colors.border,
          }}
        >
          <Txt style={{ color: active ? t.colors.onAccent : t.colors.text }}>⚙︎ Filters{active ? ` (${active})` : ''}</Txt>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x2, alignItems: 'center' }}
        style={{ flexGrow: 0, flexShrink: 0, height: 52, marginBottom: t.space.x2 }}
      >
        <QuickChip label="All" selected={!activeCatId} onPress={() => onlyCategory(null)} />
        {(categories.data ?? []).map((c) => (
          <QuickChip key={c.id} label={c.name} selected={activeCatId === c.id} onPress={() => onlyCategory(activeCatId === c.id ? null : c.id)} />
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: t.space.x4, paddingBottom: t.space.x2 }}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>
          Used gear  ›  <Txt style={{ color: t.colors.text, fontWeight: t.weight.medium as never }}>{crumb}</Txt>
          {`   ·   ${visible.length} ${visible.length === 1 ? 'result' : 'results'}`}
        </Txt>
      </View>

      {listings.loading && <Loading />}
      {listings.error && <View style={{ padding: t.space.x4 }}><ErrorNote error={listings.error} onRetry={listings.reload} /></View>}

      {!listings.loading && !listings.error && (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.listing.id}
          contentContainerStyle={{ padding: t.space.x4, paddingTop: t.space.x1, gap: t.space.x3 }}
          ListEmptyComponent={<Empty title="Nothing matches those filters" hint="Try clearing one or widening the search." />}
          renderItem={({ item: { listing, model } }) => (
            <ListingCard
              listing={listing}
              model={model}
              image={model ? imageBySlug.get(model.slug) : undefined}
              brand={model?.brandId ? brandName.get(model.brandId) : undefined}
              category={model?.categoryId ? categoryName.get(model.categoryId) : undefined}
              gradeText={gradeLabel.get(listing.gradeCode)}
              top={(gradeRank.get(listing.gradeCode) ?? 0) >= 9}
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
        filters={filters} setFilters={setFilters} active={active}
        categories={categories.data ?? []} brands={brands.data ?? []} grades={grades.data ?? []}
        counts={counts} toggle={toggle}
      />
    </View>
  )
}

function ListingCard({
  listing, model, image, brand, category, gradeText, top, onOpen, onBuy,
}: {
  listing: Listing; model: ProductModel | null; image?: string
  brand?: string; category?: string; gradeText?: string; top: boolean
  onOpen: () => void; onBuy: () => void
}) {
  const t = useTheme()
  const title = listing.title.split('·')[0].trim()
  return (
    <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.lg, overflow: 'hidden' }}>
      <Pressable onPress={onOpen} style={{ flexDirection: 'row', gap: t.space.x3, padding: t.space.x3 }}>
        <View style={{ width: 104, height: 104, borderRadius: t.radius.md, overflow: 'hidden', backgroundColor: t.colors.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
          {image
            ? <Image source={{ uri: image }} style={{ width: 104, height: 104 }} resizeMode="cover" />
            : <Txt style={{ fontSize: 30 }}>📷</Txt>}
          <View style={{ position: 'absolute', top: 6, left: 6 }}>
            <Badge label={listing.gradeCode} tone={top ? 'good' : 'accent'} />
          </View>
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Txt numberOfLines={2} style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{title}</Txt>
          <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{money(listing.priceMinor, listing.currency)}</Txt>
          <View style={{ marginTop: 2, gap: 1 }}>
            <Spec label="Condition" value={gradeText ? `${listing.gradeCode} · ${gradeText}` : listing.gradeCode} />
            {brand && <Spec label="Brand" value={brand} />}
            {category && <Spec label="Type" value={singularCategory(category)} />}
          </View>
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: t.space.x3, paddingVertical: t.space.x2, borderTopWidth: 1, borderTopColor: t.colors.border }}>
        <Txt style={{ color: t.colors.good, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>✓ TrueGlaz inspected</Txt>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>★ Graded {listing.gradeCode}</Txt>
      </View>

      <View style={{ flexDirection: 'row', gap: t.space.x2, padding: t.space.x3, paddingTop: 0 }}>
        <CardButton label="Buy now" tone="cta" onPress={onBuy} />
        <CardButton label="View details" tone="ghost" onPress={onOpen} />
      </View>
    </View>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row' }}>
      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, width: 74 }}>{label}</Txt>
      <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.xs, fontWeight: t.weight.medium as never, flex: 1 }}>{value}</Txt>
    </View>
  )
}

function CardButton({ label, tone, onPress }: { label: string; tone: 'cta' | 'ghost'; onPress: () => void }) {
  const t = useTheme()
  const cta = tone === 'cta'
  return (
    <Pressable onPress={onPress}
      style={{ flex: 1, alignItems: 'center', paddingVertical: t.space.x2, borderRadius: t.radius.md, borderWidth: 1, backgroundColor: cta ? t.colors.cta : 'transparent', borderColor: cta ? t.colors.cta : t.colors.border }}>
      <Txt style={{ color: cta ? t.colors.onCta : t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.sm }}>{label}</Txt>
    </Pressable>
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
  open, onClose, filters, setFilters, active, categories, brands, grades, counts, toggle,
}: any) {
  const t = useTheme()
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
              <Pressable onPress={onClose}><Txt style={{ color: t.colors.accent, fontWeight: t.weight.medium as never }}>Done</Txt></Pressable>
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
            <Group title="Type">
              <Wrap>
                {categories.map((c: any) => (
                  <Chip key={c.id} label={`${c.name} ${counts.category.get(c.id) ?? 0}`} selected={filters.categoryIds.includes(c.id)} disabled={(counts.category.get(c.id) ?? 0) === 0 && !filters.categoryIds.includes(c.id)} onPress={() => toggle('categoryIds', c.id)} />
                ))}
              </Wrap>
            </Group>
            <Group title="Brand">
              <Wrap>
                {brands.map((b: any) => (
                  <Chip key={b.id} label={`${b.name} ${counts.brand.get(b.id) ?? 0}`} selected={filters.brandIds.includes(b.id)} disabled={(counts.brand.get(b.id) ?? 0) === 0 && !filters.brandIds.includes(b.id)} onPress={() => toggle('brandIds', b.id)} />
                ))}
              </Wrap>
            </Group>
            <Group title="Condition">
              <Wrap>
                {grades.filter((g: any) => g.isActive).sort((a: any, b: any) => b.rank - a.rank).map((g: any) => (
                  <Chip key={g.code} label={`${g.code} ${counts.grade.get(g.code) ?? 0}`} selected={filters.grades.includes(g.code)} disabled={(counts.grade.get(g.code) ?? 0) === 0 && !filters.grades.includes(g.code)} onPress={() => toggle('grades', g.code)} />
                ))}
              </Wrap>
            </Group>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
