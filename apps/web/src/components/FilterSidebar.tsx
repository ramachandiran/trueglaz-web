import type { Brand, Category, Grade, LensRange, LensType, SensorFormat } from '@trueglaz/core'
import { activeFilterCount, EMPTY_FILTERS, type Filters } from '@trueglaz/core'
import { money } from '@trueglaz/core'
import './FilterSidebar.css'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  categories: Category[]
  brands: Brand[]
  grades: Grade[]
  lensTypes: LensType[]
  lensRanges: LensRange[]
  sensorFormats: SensorFormat[]
  counts: {
    category: Map<string, number>
    brand: Map<string, number>
    grade: Map<string, number>
    lensType: Map<string, number>
    lensRange: Map<string, number>
    sensorFormat: Map<string, number>
  }
  priceBounds: { min: number; max: number }
}

export function FilterSidebar({
  filters, onChange, categories, brands, grades,
  lensTypes, lensRanges, sensorFormats, counts, priceBounds,
}: Props) {
  const active = activeFilterCount(filters)

  const toggle = (
    key: 'categoryIds' | 'brandIds' | 'grades' | 'lensTypes' | 'lensRanges' | 'sensorFormats',
    value: string,
  ) => {
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

      {/* Only brands the current results actually contain. The catalogue now
          carries every maker that trades here, and listing all of them against
          a shelf of two produces a column of zeroes that buries the one brand
          in stock. A selected brand stays visible even at zero, so a filter
          can always be un-ticked. */}
      <Section title="Brand">
        {brands
          .filter((b) => (counts.brand.get(b.id) ?? 0) > 0 || filters.brandIds.includes(b.id))
          .map((b) => (
          <Check
            key={b.id}
            label={b.name}
            count={counts.brand.get(b.id) ?? 0}
            checked={filters.brandIds.includes(b.id)}
            onChange={() => toggle('brandIds', b.id)}
          />
        ))}
      </Section>

      {/* Shown only where the current results actually contain some. A lens
          section above a shelf of camera bodies is a list of dead ends, and a
          sensor section on an empty catalogue is worse. */}
      {lensTypes.some((t) => (counts.lensType.get(t.code) ?? 0) > 0) && (
        <Section title="Lens type">
          {lensTypes
            .filter((t) => (counts.lensType.get(t.code) ?? 0) > 0 || filters.lensTypes.includes(t.code))
            .map((t) => (
              <Check
                key={t.code}
                label={t.label}
                count={counts.lensType.get(t.code) ?? 0}
                checked={filters.lensTypes.includes(t.code)}
                onChange={() => toggle('lensTypes', t.code)}
              />
            ))}
        </Section>
      )}

      {lensRanges.some((r) => (counts.lensRange.get(r.code) ?? 0) > 0) && (
        <Section title="Focal range">
          {lensRanges
            .filter((r) => (counts.lensRange.get(r.code) ?? 0) > 0 || filters.lensRanges.includes(r.code))
            .map((r) => (
              <Check
                key={r.code}
                label={r.label}
                count={counts.lensRange.get(r.code) ?? 0}
                checked={filters.lensRanges.includes(r.code)}
                onChange={() => toggle('lensRanges', r.code)}
              />
            ))}
        </Section>
      )}

      {sensorFormats.some((f) => (counts.sensorFormat.get(f.code) ?? 0) > 0) && (
        <Section title="Sensor">
          {sensorFormats
            .filter((f) => (counts.sensorFormat.get(f.code) ?? 0) > 0 || filters.sensorFormats.includes(f.code))
            .map((f) => (
              <Check
                key={f.code}
                label={f.label}
                count={counts.sensorFormat.get(f.code) ?? 0}
                checked={filters.sensorFormats.includes(f.code)}
                onChange={() => toggle('sensorFormats', f.code)}
              />
            ))}
        </Section>
      )}

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
