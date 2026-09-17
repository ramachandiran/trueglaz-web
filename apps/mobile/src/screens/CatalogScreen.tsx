import { useMemo, useState } from 'react'
import {
  FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import {
  api, applyFilters, buildModelIndex, countBy, EMPTY_FILTERS, money, resolveModel,
  useApi, activeFilterCount, type Facetable, type Filters, type Sort,
} from '@trueglaz/core'
import { useTheme } from '../theme/ThemeContext'
import { Badge, Card, Empty, ErrorNote, Loading, Muted } from '../components/ui'

/**
 * Catalogue.
 *
 * On the web the facets sit in a left rail; a phone has no room for one, so the
 * same filter state opens in a sheet. The filtering itself is `applyFilters`
 * from core — identical behaviour, different surface.
 */
export function CatalogScreen({ navigation }: { navigation: any }) {
  const t = useTheme()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)

  const listings = useApi((a) => api.listings(a, { q: filters.q, size: 200 }), [filters.q])
  const models = useApi((a) => api.models(a), [])
  const grades = useApi((a) => api.grades(a), [])
  const brands = useApi((a) => api.brands(a), [])
  const categories = useApi((a) => api.categories(a), [])

  const rows: Facetable[] = useMemo(() => {
    if (!listings.data) return []
    const index = buildModelIndex(models.data?.content ?? [])
    return listings.data.content.map((listing) => ({ listing, model: resolveModel(listing, index) }))
  }, [listings.data, models.data])

  const gradeRank = useMemo(
    () => new Map((grades.data ?? []).map((g) => [g.code, g.rank])),
    [grades.data],
  )
  const brandName = useMemo(
    () => new Map((brands.data ?? []).map((b) => [b.id, b.name])),
    [brands.data],
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
    setFilters({
      ...filters,
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    })
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={[styles.bar, { borderBottomColor: t.colors.border, padding: t.space.x4 }]}>
        <TextInput
          value={filters.q}
          onChangeText={(q) => setFilters({ ...filters, q })}
          placeholder="Search models"
          placeholderTextColor={t.colors.textMuted}
          style={{
            flex: 1,
            color: t.colors.text,
            backgroundColor: t.colors.bgRaised,
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: t.radius.md,
            paddingHorizontal: t.space.x3,
            paddingVertical: t.space.x2,
          }}
        />
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={{
            paddingHorizontal: t.space.x3,
            paddingVertical: t.space.x2,
            borderRadius: t.radius.md,
            backgroundColor: active ? t.colors.accent : t.colors.bgRaised,
            borderWidth: 1,
            borderColor: active ? t.colors.accent : t.colors.border,
          }}
        >
          <Text style={{ color: active ? t.colors.onAccent : t.colors.text }}>
            Filters{active ? ` (${active})` : ''}
          </Text>
        </Pressable>
      </View>

      {listings.loading && <Loading />}
      {listings.error && (
        <View style={{ padding: t.space.x4 }}>
          <ErrorNote error={listings.error} onRetry={listings.reload} />
        </View>
      )}

      {!listings.loading && !listings.error && (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.listing.id}
          contentContainerStyle={{ padding: t.space.x4, gap: t.space.x3 }}
          ListHeaderComponent={
            <Muted>{visible.length} {visible.length === 1 ? 'item' : 'items'}</Muted>
          }
          ListEmptyComponent={
            <Empty title="Nothing matches those filters" hint="Try clearing one or widening the price range." />
          }
          renderItem={({ item: { listing, model } }) => (
            <Pressable onPress={() => navigation.navigate('Listing', { id: listing.id })}>
              <Card style={{ gap: t.space.x2 }}>
                <View style={styles.cardTop}>
                  <Badge
                    label={listing.gradeCode}
                    tone={(gradeRank.get(listing.gradeCode) ?? 0) >= 9 ? 'good' : 'accent'}
                  />
                  <Text style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>
                    {money(listing.priceMinor, listing.currency)}
                  </Text>
                </View>
                <Text style={{ color: t.colors.text, fontWeight: t.weight.medium as never }}>
                  {listing.title.split('·')[0].trim()}
                </Text>
                {model?.brandId && <Muted size={t.size.xs}>{brandName.get(model.brandId) ?? ''}</Muted>}
                <Muted>{listing.descriptionGenerated}</Muted>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Modal visible={sheetOpen} animationType="slide" transparent onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View
            style={{
              backgroundColor: t.colors.bgRaised,
              borderTopLeftRadius: t.radius.lg,
              borderTopRightRadius: t.radius.lg,
              maxHeight: '85%',
              padding: t.space.x4,
            }}
          >
            <View style={styles.sheetHead}>
              <Text style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>
                Filters
              </Text>
              <View style={{ flexDirection: 'row', gap: t.space.x3 }}>
                {active > 0 && (
                  <Pressable onPress={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort })}>
                    <Text style={{ color: t.colors.accent }}>Clear {active}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setSheetOpen(false)}>
                  <Text style={{ color: t.colors.accent, fontWeight: t.weight.medium as never }}>Done</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ gap: t.space.x5, paddingBottom: t.space.x6 }}>
              <Group title="Sort">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
                  {(
                    [
                      ['newest', 'Newest'],
                      ['price-asc', 'Price ↑'],
                      ['price-desc', 'Price ↓'],
                      ['grade-desc', 'Condition'],
                    ] as [Sort, string][]
                  ).map(([value, label]) => (
                    <Chip
                      key={value}
                      label={label}
                      selected={filters.sort === value}
                      onPress={() => setFilters({ ...filters, sort: value })}
                    />
                  ))}
                </View>
              </Group>

              <Group title="Type">
                <Wrap>
                  {(categories.data ?? []).map((c) => (
                    <Chip
                      key={c.id}
                      label={`${c.name} ${counts.category.get(c.id) ?? 0}`}
                      selected={filters.categoryIds.includes(c.id)}
                      disabled={(counts.category.get(c.id) ?? 0) === 0 && !filters.categoryIds.includes(c.id)}
                      onPress={() => toggle('categoryIds', c.id)}
                    />
                  ))}
                </Wrap>
              </Group>

              <Group title="Brand">
                <Wrap>
                  {(brands.data ?? []).map((b) => (
                    <Chip
                      key={b.id}
                      label={`${b.name} ${counts.brand.get(b.id) ?? 0}`}
                      selected={filters.brandIds.includes(b.id)}
                      disabled={(counts.brand.get(b.id) ?? 0) === 0 && !filters.brandIds.includes(b.id)}
                      onPress={() => toggle('brandIds', b.id)}
                    />
                  ))}
                </Wrap>
              </Group>

              <Group title="Condition">
                <Wrap>
                  {(grades.data ?? [])
                    .filter((g) => g.isActive)
                    .sort((a, b) => b.rank - a.rank)
                    .map((g) => (
                      <Chip
                        key={g.code}
                        label={`${g.code} ${counts.grade.get(g.code) ?? 0}`}
                        selected={filters.grades.includes(g.code)}
                        disabled={(counts.grade.get(g.code) ?? 0) === 0 && !filters.grades.includes(g.code)}
                        onPress={() => toggle('grades', g.code)}
                      />
                    ))}
                </Wrap>
              </Group>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme()
  return (
    <View style={{ gap: t.space.x2 }}>
      <Text
        style={{
          color: t.colors.textMuted,
          fontSize: t.size.xs,
          fontWeight: t.weight.bold as never,
          letterSpacing: 0.6,
        }}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
}

function Chip({
  label, selected, disabled, onPress,
}: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        paddingHorizontal: t.space.x3,
        paddingVertical: t.space.x2,
        borderRadius: t.radius.pill,
        borderWidth: 1,
        opacity: disabled ? 0.4 : 1,
        backgroundColor: selected ? t.colors.accentSoft : t.colors.bg,
        borderColor: selected ? t.colors.accent : t.colors.border,
      }}
    >
      <Text style={{ color: selected ? t.colors.accent : t.colors.text, fontSize: t.size.sm }}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 8, alignItems: 'center', borderBottomWidth: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
})
