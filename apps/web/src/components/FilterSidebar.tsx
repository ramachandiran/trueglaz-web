import type { Brand, Category, Grade } from '@trueglaz/core'
import { activeFilterCount, EMPTY_FILTERS, type Filters } from '@trueglaz/core'
import { money } from '@trueglaz/core'
import './FilterSidebar.css'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  categories: Category[]
  brands: Brand[]
  grades: Grade[]
  counts: {
    category: Map<string, number>
    brand: Map<string, number>
    grade: Map<string, number>
  }
  priceBounds: { min: number; max: number }
}

export function FilterSidebar({
  filters, onChange, categories, brands, grades, counts, priceBounds,
}: Props) {
  const active = activeFilterCount(filters)

  const toggle = (key: 'categoryIds' | 'brandIds' | 'grades', value: string) => {
    const list = filters[key]
    onChange({
      ...filters,
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    })
  }

  return (
    <aside className="fs" aria-label="Filters">
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
      <Section title="Type">
        {categories.map((c) => (
          <Check
            key={c.id}
            label={c.name}
            count={counts.category.get(c.id) ?? 0}
            checked={filters.categoryIds.includes(c.id)}
            onChange={() => toggle('categoryIds', c.id)}
          />
        ))}
      </Section>

      <Section title="Brand">
        {brands.map((b) => (
          <Check
            key={b.id}
            label={b.name}
            count={counts.brand.get(b.id) ?? 0}
            checked={filters.brandIds.includes(b.id)}
            onChange={() => toggle('brandIds', b.id)}
          />
        ))}
      </Section>

      <Section title="Condition">
        {grades.map((g) => (
          <Check
            key={g.code}
            label={`${g.code} · ${g.label}`}
            count={counts.grade.get(g.code) ?? 0}
            checked={filters.grades.includes(g.code)}
            onChange={() => toggle('grades', g.code)}
          />
        ))}
      </Section>

      <Section title="Price">
        <div className="fs__price">
          <label className="fs__price-field">
            <span className="tg-visually-hidden">Minimum price in rupees</span>
            <input
              type="number"
              className="tg-input"
              inputMode="numeric"
              min={0}
              placeholder={String(Math.floor(priceBounds.min / 100))}
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
              placeholder={String(Math.ceil(priceBounds.max / 100))}
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
        <p className="fs__hint tg-muted">
          {money(priceBounds.min)} – {money(priceBounds.max)} in stock
        </p>
      </Section>
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
  // A zero-count option that is not selected cannot change the result, so it is
  // disabled rather than hidden — the facet list stays stable as you filter.
  const disabled = count === 0 && !checked
  return (
    <label className={`fs__check${disabled ? ' fs__check--disabled' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="fs__check-label">{label}</span>
      <span className="fs__check-count">{count}</span>
    </label>
  )
}
