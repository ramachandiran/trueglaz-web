import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '@trueglaz/core'
import { useApi } from '@trueglaz/core'
import { FilterSidebar } from '../components/FilterSidebar'
import { photoKindFor } from '../components/GearPhoto'
import { GradeBadge, Empty, ErrorNote, Loading } from '../components/ui'
import {
  activeFilterCount, EMPTY_FILTERS, singularCategory, type Filters, type SearchHit, type Sort,
} from '@trueglaz/core'

/** The sorts the results header offers, and so the only ones a link may ask for. */
const SORTS: Sort[] = ['newest', 'price-asc', 'price-desc', 'grade-desc']
/** Results per "Show more"; the API serves at most 60 at once. */
const PAGE = 24
import { money } from '@trueglaz/core'
import './CatalogPage.css'
import { ModelPhoto } from '../components/ModelPhoto'

export function CatalogPage() {
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS)
  const [params] = useSearchParams()

  // Search, sorting, paging and the filter options all come from the API, over
  // the whole shop. Doing it here over one page of listings lost every unit
  // past the first hundred and counted only those.
  const key = JSON.stringify(filters)
  const search = useApi(() => api.searchListings(filters, 0, PAGE), [key])

  // Pages after the first, appended by "Show more". Tagged with the search they
  // belong to, so a page that lands after the filters changed is dropped.
  const [more, setMore] = useState<{ key: string; hits: SearchHit[]; next: number }>({ key: '', hits: [], next: 1 })
  const [loadingMore, setLoadingMore] = useState(false)
  // On a phone the filters fold away behind one button so the first screen is
  // results, not ~1,350 px of checkboxes. On a wide screen they are always shown.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const latestKey = useRef(key)
  latestKey.current = key
  const extra = more.key === key ? more : { key, hits: [], next: 1 }
  async function showMore() {
    const forKey = key
    setLoadingMore(true)
    try {
      const page = await api.searchListings(filters, extra.next, PAGE)
      if (latestKey.current === forKey) setMore({ key: forKey, hits: [...extra.hits, ...page.hits], next: extra.next + 1 })
    } finally { setLoadingMore(false) }
  }
  const setFilters = setFiltersState
  const grades = useApi(() => api.grades(), [])
  const brands = useApi(() => api.brands(), [])
  const mounts = useApi(() => api.mounts(), [])
  const categories = useApi(() => api.categories(), [])
  const meta = useApi(() => api.meta(), [])
  const delivery = meta.data ? `+ ${money(meta.data.shippingMinor)} delivery` : '+ delivery'

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
  // The home page's rows link in here, so the params they write have to mean
  // something: a mount by name, and a sort the results header already offers.
  const mountName = params.get('mount')
  const sortParam = params.get('sort')

  useEffect(() => {
    const category = categories.data?.find((c) => c.slug === catSlug)
    const brand = brands.data?.find(
      (b) => b.name.toLowerCase() === (brandName ?? '').toLowerCase(),
    )
    const mount = mounts.data?.find(
      (m) => m.name.toLowerCase() === (mountName ?? '').toLowerCase(),
    )
    setFilters((current) => ({
      ...current,
      q,
      categoryIds: category ? [category.id] : [],
      brandIds: brand ? [brand.id] : [],
      mountIds: mount ? [mount.id] : [],
      // An unrecognised sort is ignored rather than defaulted over, so a stale
      // link cannot silently reorder the shelf.
      sort: SORTS.includes(sortParam as Sort) ? (sortParam as Sort) : current.sort,
    }))
  }, [q, catSlug, brandName, mountName, sortParam, categories.data, brands.data, mounts.data])

  const hits = [...(search.data?.hits ?? []), ...extra.hits]
  const total = search.data?.total ?? 0

  const heading = useMemo(() => {
    if (q) return `"${q}"`
    const category = categories.data?.find((c) => c.slug === catSlug)
    if (category) return category.name
    if (brandName) return brandName
    if (mountName) return `${mountName} mount`
    return 'All gear'
  }, [q, catSlug, brandName, mountName, categories.data])

  return (
    <div className="catalog">
      <div id="catalog-filters" className="catalog__filters" data-open={filtersOpen || undefined}>
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          facets={search.data?.facets ?? null}
          price={search.data?.price ?? null}
        />
      </div>

      <section id="results" tabIndex={-1} className="catalog__results" aria-label="Listings">
        <div className="results__bar">
          <h1 className="results__count">
            {total === 0 ? 'No results' : (
              <>
                <strong>{total}</strong>
                {total === 1 ? ' result' : ' results'}
              </>
            )}
            {' for '}<span className="results__term">{heading}</span>
          </h1>
          <button
            type="button"
            className="tg-button results__filters"
            aria-expanded={filtersOpen}
            aria-controls="catalog-filters"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            {filtersOpen ? 'Hide filters' : 'Filters'}
            {activeFilterCount(filters) > 0 && ` (${activeFilterCount(filters)})`}
          </button>
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

        {/* Only the first load takes over; refining keeps the old results up
            until the new ones arrive, so the page does not flash. */}
        {search.loading && !search.data && <Loading label="Loading listings" />}
        {search.error && <ErrorNote error={search.error} onRetry={search.reload} />}

        {search.data && !search.error && hits.length === 0 && (
          <Empty
            title="Nothing matches those filters"
            hint="Try clearing a filter or widening the price range."
          />
        )}

        {hits.length > 0 && (
          <ol className="results">
            {hits.map(({ listing, modelSlug, categoryId, brandId }) => {
              const category = categories.data?.find((c) => c.id === categoryId)
              return (
                <li key={listing.id} className="result">
                  <Link to={`/listings/${listing.id}`} className="result__photo-link" tabIndex={-1} aria-hidden="true">
                    <ModelPhoto slug={modelSlug} kind={photoKindFor(category?.name)} alt={listing.title.split('·')[0].trim()} />
                  </Link>

                  <div className="result__body">
                    <Link to={`/listings/${listing.id}`} className="result__title">
                      {listing.title.split('·')[0].trim()}
                    </Link>
                    <p className="result__brand tg-muted">
                      {brandId ? brandById.get(brandId) ?? '' : 'Unlisted model'}
                      {category && ` · ${singularCategory(category.name)}`}
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
                    <span className="result__ship tg-muted">{delivery}</span>
                    <Link to={`/listings/${listing.id}`} className="tg-button result__cta">
                      See the condition report
                    </Link>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {hits.length < total && (
          <div className="results__more">
            <button
              type="button"
              className="tg-button"
              disabled={loadingMore}
              onClick={showMore}
            >
              {loadingMore ? 'Loading…' : `Show more (${total - hits.length} left)`}
            </button>
          </div>
        )}
      </section>

    </div>
  )
}
