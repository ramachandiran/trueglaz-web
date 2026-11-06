import { activeFilterCount, EMPTY_FILTERS, type FacetOption, type Filters, type SearchFacets } from '@trueglaz/core'
import { money } from '@trueglaz/core'
import './FilterSidebar.css'

type ListKey = 'categoryIds' | 'brandIds' | 'mountIds' | 'lensTypes' | 'lensRanges' | 'sensorFormats' | 'grades'

/**
 * The groups, in the order a shopper narrows. Budget and condition come first
 * (Price is drawn above this list): they are what buyers of used gear decide
 * on, and they used to sit below the sidebar's own fold, 33 Tab presses down.
 * Then what it is, who made it, will it fit, and the lens-only questions. The
 * options themselves come from the API.
 */
const GROUPS: { key: ListKey; facet: keyof SearchFacets; title: string }[] = [
  { key: 'grades', facet: 'grade', title: 'Condition' },
  { key: 'categoryIds', facet: 'category', title: 'Type' },
  { key: 'brandIds', facet: 'brand', title: 'Brand' },
  { key: 'mountIds', facet: 'mount', title: 'Mount' },
  { key: 'lensTypes', facet: 'lensType', title: 'Lens type' },
  { key: 'lensRanges', facet: 'lensRange', title: 'Focal range' },
  { key: 'sensorFormats', facet: 'sensorFormat', title: 'Sensor' },
]

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  /** Null until the first search returns. */
  facets: SearchFacets | null
  /** The price span of what the other filters leave. */
  price: { minMinor: number; maxMinor: number } | null
}

/**
 * Filters built from what is actually in stock.
 *
 * Every option comes from the search, counted against the other selections, so
 * the sidebar only offers choices that lead somewhere: lens groups appear when
 * there is glass to filter, brands narrow to camera makers once Cameras is
 * picked, and a new brand or mount shows up with its first unit. A group with
 * nothing to offer is not drawn at all.
 */
export function FilterSidebar({ filters, onChange, facets, price }: Props) {
  const active = activeFilterCount(filters)

  const toggle = (key: ListKey, value: string) => {
    const list = filters[key]
    onChange({
      ...filters,
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    })
  }

  return (
    <aside className="fs" aria-label="Filters">
      <a className="skip-link" href="#results">Skip to results</a>
      <div className="fs__head">
        <h2 className="fs__title">Filters</h2>
        {active > 0 && (
          <button
            type="button"
            className="tg-button tg-button--subtle fs__clear"
            onClick={() => onChange({ ...EMPTY_FILTERS, sort: filters.sort })}
          >
            Clear {active}
          </button>
        )}
      </div>

      {/* Search lives in the header and sort above the results; repeating them
          here would be two controls for one thing, and two places to look. */}

      <Section title="Price">
        <div className="fs__price">
          <label className="fs__price-field">
            <span className="tg-visually-hidden">Minimum price in rupees</span>
            <input
              type="number"
              className="tg-input"
              inputMode="numeric"
              min={0}
              placeholder={price ? String(Math.floor(price.minMinor / 100)) : 'Min'}
              value={filters.minPriceMinor === null ? '' : filters.minPriceMinor / 100}
              onChange={(e) =>
                onChange({
                  ...filters,
                  minPriceMinor: e.target.value === '' ? null : Number(e.target.value) * 100,
                })
              }
            />
          </label>
          <span className="fs__price-dash" aria-hidden="true">–</span>
          <label className="fs__price-field">
            <span className="tg-visually-hidden">Maximum price in rupees</span>
            <input
              type="number"
              className="tg-input"
              inputMode="numeric"
              min={0}
              placeholder={price ? String(Math.ceil(price.maxMinor / 100)) : 'Max'}
              value={filters.maxPriceMinor === null ? '' : filters.maxPriceMinor / 100}
              onChange={(e) =>
                onChange({
                  ...filters,
                  maxPriceMinor: e.target.value === '' ? null : Number(e.target.value) * 100,
                })
              }
            />
          </label>
        </div>
        {price && (
          <p className="fs__hint tg-muted">
            {money(price.minMinor)} – {money(price.maxMinor)} in stock
          </p>
        )}
      </Section>

      {facets && GROUPS.map(({ key, facet, title }) => {
        const options: FacetOption[] = facets[facet]
        if (options.length === 0) return null
        return (
          <Section key={key} title={title}>
            {options.map((o) => (
              <Check
                key={o.value}
                label={o.label}
                count={o.count}
                checked={filters[key].includes(o.value)}
                onChange={() => toggle(key, o.value)}
              />
            ))}
          </Section>
        )
      })}

    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="fs__section">
      <h3 className="fs__section-title">{title}</h3>
      <div className="fs__section-body">{children}</div>
    </section>
  )
}

function Check({
  label, count, checked, onChange,
}: { label: string; count: number; checked: boolean; onChange: () => void }) {
  // The API only sends options with stock, and ones already ticked; a ticked
  // one at zero stays enabled so it can be unticked.
  const disabled = count === 0 && !checked
  return (
    <label className={`fs__check${disabled ? ' fs__check--disabled' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="fs__check-label">{label}</span>
      <span className="fs__check-count">{count}</span>
    </label>
  )
}
