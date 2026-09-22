import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '@trueglaz/core'
import { useApi } from '@trueglaz/core'
import { FilterSidebar } from '../components/FilterSidebar'
import { GearPhoto, photoKindFor } from '../components/GearPhoto'
import { GradeBadge, Empty, ErrorNote, Loading } from '../components/ui'
import {
  applyFilters, buildModelIndex, countBy, EMPTY_FILTERS,
  resolveModel, type Facetable, type Filters, type Sort,
} from '@trueglaz/core'
import { money } from '@trueglaz/core'
import './CatalogPage.css'

export function CatalogPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [params] = useSearchParams()

  // Text search is the one facet the API can genuinely narrow, so it is sent up.
  // Everything else is faceted here — see lib/filters.ts for why.
  const listings = useApi(() => api.listings({ q: filters.q, size: 200 }), [filters.q])
  const models = useApi(() => api.models(), [])
  const grades = useApi(() => api.grades(), [])
  const brands = useApi(() => api.brands(), [])
  const categories = useApi(() => api.categories(), [])

  const rows: Facetable[] = useMemo(() => {
    if (!listings.data) return []
    const index = buildModelIndex(models.data?.content ?? [])
    return listings.data.content.map((listing) => ({
      listing,
      model: resolveModel(listing, index),
    }))
  }, [listings.data, models.data])

  const brandById = useMemo(
    () => new Map((brands.data ?? []).map((b) => [b.id, b.name])),
    [brands.data],
  )

  const gradeRank = useMemo(
    () => new Map((grades.data ?? []).map((g) => [g.code, g.rank])),
    [grades.data],
  )

  // The URL is what the header search and the category strip write to, so it
  // drives the filters rather than the other way round. Reference data arrives
  // after the first render, which is why a slug resolves to an id in an effect
  // rather than during it.
  const q = params.get('q') ?? ''
  const catSlug = params.get('cat')
  const brandName = params.get('brand')

  useEffect(() => {
    const category = categories.data?.find((c) => c.slug === catSlug)
    const brand = brands.data?.find(
      (b) => b.name.toLowerCase() === (brandName ?? '').toLowerCase(),
    )
    setFilters((current) => ({
      ...current,
      q,
      categoryIds: category ? [category.id] : [],
      brandIds: brand ? [brand.id] : [],
    }))
  }, [q, catSlug, brandName, categories.data, brands.data])

  const visible = useMemo(() => applyFilters(rows, filters, gradeRank), [rows, filters, gradeRank])

  const heading = useMemo(() => {
    if (q) return `"${q}"`
    const category = categories.data?.find((c) => c.slug === catSlug)
    if (category) return category.name
    if (brandName) return brandName
    return 'All gear'
  }, [q, catSlug, brandName, categories.data])

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
        priceBounds={priceBounds}
      />

      <section className="catalog__results" aria-label="Listings">
        <div className="results__bar">
          <p className="results__count">
            {visible.length === 0 ? 'No results' : (
              <>
                <strong>{visible.length}</strong>
                {visible.length === 1 ? ' result' : ' results'}
              </>
            )}
            {' for '}<span className="results__term">{heading}</span>
          </p>
          <label className="results__sort">
            <span className="tg-muted">Sort by</span>
            <select
              className="tg-select"
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value as Sort })}
              aria-label="Sort results"
            >
              <option value="newest">Newest arrivals</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="grade-desc">Condition: best first</option>
            </select>
          </label>
        </div>

        {listings.loading && <Loading label="Loading listings" />}
        {listings.error && <ErrorNote error={listings.error} onRetry={listings.reload} />}

        {!listings.loading && !listings.error && visible.length === 0 && (
          <Empty
            title="Nothing matches those filters"
            hint="Try clearing a filter or widening the price range."
          />
        )}

        {visible.length > 0 && (
          <ol className="results">
            {visible.map(({ listing, model }) => {
              const category = categories.data?.find((c) => c.id === model?.categoryId)
              return (
                <li key={listing.id} className="result">
                  <Link to={`/listings/${listing.id}`} className="result__photo-link" tabIndex={-1} aria-hidden="true">
                    <GearPhoto kind={photoKindFor(category?.name)} />
                  </Link>

                  <div className="result__body">
                    <Link to={`/listings/${listing.id}`} className="result__title">
                      {listing.title.split('·')[0].trim()}
                    </Link>
                    <p className="result__brand tg-muted">
                      {model?.brandId ? brandById.get(model.brandId) ?? '' : 'Unlisted model'}
                      {category && ` · ${singular(category.name)}`}
                    </p>

                    <div className="result__grade">
                      <GradeBadge code={listing.gradeCode} rank={gradeRank.get(listing.gradeCode)} />
                      <span className="tg-muted">
                        graded and disclosed by TrueGlaz
                      </span>
                    </div>

                    <p className="result__desc">{listing.descriptionGenerated}</p>

                    <p className="result__promise tg-muted">
                      One unit only · inspected against a {category?.name?.toLowerCase().includes('camera') ? '25' : '27'}-point checklist
                    </p>
                  </div>

                  <div className="result__buy">
                    <span className="result__price">{money(listing.priceMinor, listing.currency)}</span>
                    <span className="result__ship tg-muted">+ ₹400 delivery</span>
                    <Link to={`/listings/${listing.id}`} className="tg-button result__cta">
                      See the condition report
                    </Link>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

    </div>
  )
}

/** "Lenses" is not a "Lense". Small list, explicit answer. */
function singular(name: string): string {
  const known: Record<string, string> = { Lenses: 'Lens', Cameras: 'Camera', Accessories: 'Accessory' }
  return known[name] ?? name.replace(/s$/, '')
}
