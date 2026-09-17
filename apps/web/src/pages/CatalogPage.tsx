import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@trueglaz/core'
import { useApi } from '@trueglaz/core'
import { FilterSidebar } from '../components/FilterSidebar'
import { GradeBadge, Empty, ErrorNote, Loading } from '../components/ui'
import {
  applyFilters, buildModelIndex, countBy, EMPTY_FILTERS,
  resolveModel, type Facetable, type Filters,
} from '@trueglaz/core'
import { money } from '@trueglaz/core'
import './CatalogPage.css'

export function CatalogPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)

  // Text search is the one facet the API can genuinely narrow, so it is sent up.
  // Everything else is faceted here — see lib/filters.ts for why.
  const listings = useApi((a) => api.listings(a, { q: filters.q, size: 200 }), [filters.q])
  const models = useApi((a) => api.models(a), [])
  const grades = useApi((a) => api.grades(a), [])
  const brands = useApi((a) => api.brands(a), [])
  const categories = useApi((a) => api.categories(a), [])

  const rows: Facetable[] = useMemo(() => {
    if (!listings.data) return []
    const index = buildModelIndex(models.data?.content ?? [])
    return listings.data.content.map((listing) => ({
      listing,
      model: resolveModel(listing, index),
    }))
  }, [listings.data, models.data])

  const brandName = useMemo(
    () => new Map((brands.data ?? []).map((b) => [b.id, b.name])),
    [brands.data],
  )

  const gradeRank = useMemo(
    () => new Map((grades.data ?? []).map((g) => [g.code, g.rank])),
    [grades.data],
  )

  const visible = useMemo(() => applyFilters(rows, filters, gradeRank), [rows, filters, gradeRank])

  // Facet counts reflect everything else that is selected, so a count of zero
  // genuinely means "picking this shows nothing".
  const counts = useMemo(
    () => ({
      category: countBy(
        applyFilters(rows, { ...filters, categoryIds: [] }, gradeRank),
        (r) => r.model?.categoryId,
      ),
      brand: countBy(
        applyFilters(rows, { ...filters, brandIds: [] }, gradeRank),
        (r) => r.model?.brandId,
      ),
      grade: countBy(
        applyFilters(rows, { ...filters, grades: [] }, gradeRank),
        (r) => r.listing.gradeCode,
      ),
    }),
    [rows, filters, gradeRank],
  )

  const priceBounds = useMemo(() => {
    const prices = rows.map((r) => r.listing.priceMinor)
    return prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : { min: 0, max: 0 }
  }, [rows])

  return (
    <div className="catalog">
      <FilterSidebar
        filters={filters}
        onChange={setFilters}
        categories={categories.data ?? []}
        brands={brands.data ?? []}
        grades={(grades.data ?? []).filter((g) => g.isActive).sort((a, b) => b.rank - a.rank)}
        counts={counts}
        resultCount={visible.length}
        priceBounds={priceBounds}
      />

      <section className="catalog__results" aria-label="Listings">
        {listings.loading && <Loading label="Loading listings" />}
        {listings.error && <ErrorNote error={listings.error} onRetry={listings.reload} />}

        {!listings.loading && !listings.error && visible.length === 0 && (
          <Empty
            title="Nothing matches those filters"
            hint="Try clearing a filter or widening the price range."
          />
        )}

        {visible.length > 0 && (
          <div className="catalog__grid">
            {visible.map(({ listing, model }) => (
              <Link key={listing.id} to={`/listings/${listing.id}`} className="card tg-card">
                <div className="card__top">
                  <GradeBadge code={listing.gradeCode} rank={gradeRank.get(listing.gradeCode)} />
                  <span className="card__price">{money(listing.priceMinor, listing.currency)}</span>
                </div>
                <h3 className="card__title">{listing.title.split('·')[0].trim()}</h3>
                {model?.brandId && (
                  <p className="card__sub tg-muted">{brandName.get(model.brandId) ?? ''}</p>
                )}
                <p className="card__desc">{listing.descriptionGenerated}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
