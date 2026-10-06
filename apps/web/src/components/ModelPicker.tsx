import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Brand, Category, ProductModel } from '@trueglaz/core'
import './ModelPicker.css'

/**
 * Finding your own gear in the catalogue.
 *
 * It is a combobox rather than a select, because 200-odd models is far too many
 * to scroll and a seller already knows what they own — they want to type three
 * characters and see it. It is also not a select for a second reason: the
 * catalogue is not complete and never will be, so typing something that is not
 * in it has to stay possible. The list suggests; it does not gate.
 *
 * Matching is the API's, not ours. It searches the brand and the model name
 * together by token, so "canon r6" finds "EOS R6 Mark II" even though those two
 * words are not adjacent anywhere in the data. Doing it here would mean a second
 * implementation drifting from the one that counts.
 */
export function ModelPicker({
  value, onChange, onPick, models, brandId, categoryId, brands, categories, placeholder,
}: {
  value: string
  onChange: (text: string) => void
  /** Fires with the catalogue row when one is chosen, or null when the text no longer matches. */
  onPick: (model: ProductModel | null) => void
  models: ProductModel[]
  brandId: string
  categoryId: string
  brands: Brand[]
  categories: Category[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const listId = useId()

  const brandName = useMemo(
    () => new Map(brands.map((b) => [b.id, b.name])),
    [brands],
  )

  /**
   * Narrowed by what the form already knows before anything is typed.
   *
   * Somebody who has said "Canon" and "Lenses" should not be offered a Nikon
   * body, and the moment they have said both, an empty box can already show the
   * right shelf instead of nothing.
   */
  const pool = useMemo(
    () => models.filter((m) =>
      (!brandId || m.brandId === brandId) &&
      (!categoryId || m.categoryId === categoryId)),
    [models, brandId, categoryId],
  )

  const matches = useMemo(() => {
    const tokens = value.toLowerCase().split(/\s+/).filter(Boolean)
    const scored = pool.filter((m) => {
      if (tokens.length === 0) return true
      const hay = `${brandName.get(m.brandId ?? '') ?? ''} ${m.name}`.toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
    return scored.slice(0, 12)
  }, [pool, value, brandName])

  const exact = useMemo(
    () => pool.find((m) => norm(m.name) === norm(value)) ?? null,
    [pool, value],
  )

  // Told on every change rather than only on a click: somebody who types the
  // name in full has matched it, and somebody who then edits one character has
  // stopped matching it. Both have to reach the form.
  useEffect(() => { onPick(exact) }, [exact])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  function choose(m: ProductModel) {
    onChange(m.name)
    onPick(m)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpen(true); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    // Enter picks the highlighted row, and does NOT submit the form behind it.
    if (e.key === 'Enter' && matches[active]) { e.preventDefault(); choose(matches[active]) }
  }

  const needsBrand = !brandId || !categoryId

  return (
    <div className="mp" ref={box}>
      <input
        className="tg-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && (
        <ul className="mp__list" id={listId} role="listbox">
          {needsBrand && (
            <li className="mp__note">Choose a type and a brand first, and this narrows to them.</li>
          )}
          {matches.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={`mp__option${i === active ? ' mp__option--on' : ''}`}
                onMouseEnter={() => setActive(i)}
                // mousedown, not click: the input's blur would close the list
                // before a click ever landed on it.
                onMouseDown={(e) => { e.preventDefault(); choose(m) }}
              >
                <span className="mp__name">{m.name}</span>
                <span className="mp__meta">{describe(m, brandName.get(m.brandId ?? ''), categories)}</span>
              </button>
            </li>
          ))}
          {!needsBrand && matches.length === 0 && (
            <li className="mp__note">
              Nothing in our catalogue matches that. Carry on typing — we will match it by hand.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/** The one line under a suggestion that tells two similar models apart. */
function describe(m: ProductModel, brand: string | undefined, categories: Category[]): string {
  const bits: string[] = []
  if (brand) bits.push(brand)
  const cat = categories.find((c) => c.id === m.categoryId)
  if (cat) bits.push(cat.name === 'Lenses' ? 'Lens' : 'Camera')
  if (m.focalLengthMinMm && m.focalLengthMaxMm) {
    bits.push(m.focalLengthMinMm === m.focalLengthMaxMm
      ? `${m.focalLengthMinMm}mm`
      : `${m.focalLengthMinMm}–${m.focalLengthMaxMm}mm`)
  }
  return bits.join(' · ')
}

/** Same comparison the API uses when it links a typed model to the catalogue. */
function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}
