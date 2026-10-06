import type { Listing, ProductModel } from './types'

export interface Filters {
  q: string
  categoryIds: string[]
  brandIds: string[]
  /** Which lens mount the body or glass uses — the "will it fit" facet. */
  mountIds: string[]
  /** prime | zoom | super_zoom. Lenses only; a body has no answer. */
  lensTypes: string[]
  /** ultra_wide … super_telephoto, plus macro and tilt-shift. Lenses only. */
  lensRanges: string[]
  /** full_frame | aps_c | … — the one facet that applies to bodies and glass alike. */
  sensorFormats: string[]
  grades: string[]
  minPriceMinor: number | null
  maxPriceMinor: number | null
  sort: Sort
}

export type Sort = 'newest' | 'price-asc' | 'price-desc' | 'grade-desc'

export const EMPTY_FILTERS: Filters = {
  q: '',
  categoryIds: [],
  brandIds: [],
  mountIds: [],
  lensTypes: [],
  lensRanges: [],
  sensorFormats: [],
  grades: [],
  minPriceMinor: null,
  maxPriceMinor: null,
  sort: 'newest',
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.q ? 1 : 0) +
    f.categoryIds.length +
    f.brandIds.length +
    f.mountIds.length +
    f.lensTypes.length +
    f.lensRanges.length +
    f.sensorFormats.length +
    f.grades.length +
    (f.minPriceMinor !== null ? 1 : 0) +
    (f.maxPriceMinor !== null ? 1 : 0)
  )
}

/**
 * Listings carry a generated title but no model, brand or category id, so brand
 * and category faceting has to be resolved here.
 *
 * `ListingService.publishRow` builds the title as `"{model name} · {grade}"`,
 * which makes the model name recoverable. It is a stopgap: exposing
 * productModelId on the listing payload would remove this guesswork entirely
 * and let the server do the filtering. Items listed under free text rather than
 * a catalogue model resolve to null and are simply never matched by a brand or
 * category filter.
 */
export function buildModelIndex(models: ProductModel[]): Map<string, ProductModel> {
  const index = new Map<string, ProductModel>()
  for (const m of models) index.set(normalise(m.name), m)
  return index
}

export function resolveModel(
  listing: Listing,
  index: Map<string, ProductModel>,
): ProductModel | null {
  const name = listing.title.split('·')[0]
  return index.get(normalise(name)) ?? null
}

function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export interface Facetable {
  listing: Listing
  model: ProductModel | null
}

export function applyFilters(
  rows: Facetable[],
  f: Filters,
  gradeRank: Map<string, number>,
): Facetable[] {
  const out = rows.filter(({ listing, model }) => {
    if (f.categoryIds.length && !(model && f.categoryIds.includes(model.categoryId ?? ''))) {
      return false
    }
    if (f.brandIds.length && !(model && f.brandIds.includes(model.brandId ?? ''))) {
      return false
    }
    if (f.mountIds.length && !(model && f.mountIds.includes(model.mountId ?? ''))) {
      return false
    }
    // A body has no lens type or range, so these three never match one — which
    // is right: picking "telephoto" is asking for glass, and a camera appearing
    // in those results would be a bug, not a bonus.
    if (f.lensTypes.length && !(model && f.lensTypes.includes(model.lensTypeCode ?? ''))) {
      return false
    }
    if (f.lensRanges.length && !(model && f.lensRanges.includes(model.lensRangeCode ?? ''))) {
      return false
    }
    if (f.sensorFormats.length && !(model && f.sensorFormats.includes(model.sensorFormat ?? ''))) {
      return false
    }
    if (f.grades.length && !f.grades.includes(listing.gradeCode)) return false
    if (f.minPriceMinor !== null && listing.priceMinor < f.minPriceMinor) return false
    if (f.maxPriceMinor !== null && listing.priceMinor > f.maxPriceMinor) return false
    return true
  })

  const sorted = [...out]
  switch (f.sort) {
    case 'price-asc':
      sorted.sort((a, b) => a.listing.priceMinor - b.listing.priceMinor)
      break
    case 'price-desc':
      sorted.sort((a, b) => b.listing.priceMinor - a.listing.priceMinor)
      break
    case 'grade-desc':
      sorted.sort(
        (a, b) =>
          (gradeRank.get(b.listing.gradeCode) ?? 0) - (gradeRank.get(a.listing.gradeCode) ?? 0),
      )
      break
    case 'newest':
    default:
      sorted.sort(
        (a, b) =>
          new Date(b.listing.publishedAt ?? b.listing.createdAt).getTime() -
          new Date(a.listing.publishedAt ?? a.listing.createdAt).getTime(),
      )
  }
  return sorted
}

/** Counts per facet value, computed against everything the other facets allow. */
export function countBy<T>(rows: Facetable[], key: (r: Facetable) => T | null | undefined) {
  const counts = new Map<T, number>()
  for (const r of rows) {
    const k = key(r)
    if (k === null || k === undefined) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return counts
}
