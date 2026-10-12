import { useMemo, useState } from 'react'
import { api, ApiError, useApi, type Category } from '@trueglaz/core'

/**
 * Adding to the gear catalogue: a new brand, or a new model under a brand.
 *
 * A model added here is live at once — it shows up in the consignment form's
 * model search the moment it is saved, so a seller (or staff on their behalf)
 * can list gear the catalogue did not have before. The lens-only fields appear
 * only when the category is Lenses, because a camera body has no answer to them.
 */
export function CatalogueSettingsPage() {
  const brands = useApi(() => api.brands(), [])
  const categories = useApi(() => api.categories(), [])
  const models = useApi(() => api.models(), [])
  const lensTypes = useApi(() => api.lensTypes(), [])
  const lensRanges = useApi(() => api.lensRanges(), [])
  const sensorFormats = useApi(() => api.sensorFormats(), [])
  const mounts = useApi(() => api.mounts(), [])

  const modelsByBrand = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of models.data?.content ?? []) if (x.brandId) m.set(x.brandId, (m.get(x.brandId) ?? 0) + 1)
    return m
  }, [models.data])

  return (
    <section>
      <h2 className="st__h">Catalogue</h2>
      <p className="st__lede">
        The brands and models the platform knows about. Anything added here is available straight away when a seller
        consigns gear — no deploy. Existing entries are not edited here.
      </p>

      <AddBrand onDone={() => brands.reload()} brandCount={brands.data?.length ?? 0} />

      <AddModel
        categories={categories.data ?? []}
        onDone={() => { models.reload() }}
        lensTypes={(lensTypes.data ?? []).map((t) => ({ code: t.code, label: t.label }))}
        lensRanges={(lensRanges.data ?? []).map((t) => ({ code: t.code, label: t.label }))}
        sensorFormats={(sensorFormats.data ?? []).map((t) => ({ code: t.code, label: t.label }))}
        mounts={(mounts.data ?? []).map((m) => ({ id: m.id, name: m.name }))}
        brands={(brands.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
      />

      <h3 className="st__kicker">Brands and how many models each has</h3>
      {brands.data && (
        <ul className="st__changes">
          {brands.data.map((b) => (
            <li key={b.id}><strong>{b.name}</strong> <span className="st__muted">· {modelsByBrand.get(b.id) ?? 0} models</span></li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AddBrand({ onDone, brandCount }: { onDone: () => void; brandCount: number }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function save() {
    setBusy(true); setError(null)
    try {
      const b = await api.createBrand(name.trim())
      setSaved(b.name); setName(''); onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(false) }
  }

  return (
    <div className="st__card">
      <h3 className="st__card-title">Add a brand</h3>
      <p className="st__muted">A maker of cameras or lenses. {brandCount} so far.</p>
      <div className="st__actions">
        <input className="tg-input" placeholder="e.g. Leica" value={name} maxLength={60}
          onChange={(e) => { setName(e.target.value); setSaved(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim().length >= 2 && !busy) save() }} style={{ minWidth: 220 }} />
        <button className="tg-button tg-button--primary" disabled={name.trim().length < 2 || busy} onClick={save}>
          {busy ? 'Adding…' : 'Add brand'}
        </button>
        {saved && <span className="st__ok" role="status">Added “{saved}”</span>}
      </div>
      {error && <p className="st__error" role="alert">{error}</p>}
    </div>
  )
}

type Opt = { code: string; label: string }

function AddModel({
  brands, categories, mounts, lensTypes, lensRanges, sensorFormats, onDone,
}: {
  brands: { id: string; name: string }[]
  categories: Category[]
  mounts: { id: string; name: string }[]
  lensTypes: Opt[]
  lensRanges: Opt[]
  sensorFormats: Opt[]
  onDone: () => void
}) {
  const [brandId, setBrandId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [mountId, setMountId] = useState('')
  const [sensorFormat, setSensorFormat] = useState('')
  const [lensTypeCode, setLensTypeCode] = useState('')
  const [lensRangeCode, setLensRangeCode] = useState('')
  const [focalMin, setFocalMin] = useState('')
  const [focalMax, setFocalMax] = useState('')
  const [msrp, setMsrp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const category = categories.find((c) => c.id === categoryId)
  const isLens = (category?.slug ?? '').includes('lens')
  const ready = brandId && categoryId && name.trim().length >= 2

  async function save() {
    setBusy(true); setError(null)
    try {
      const m = await api.createModel({
        brandId, categoryId, name: name.trim(),
        mountId: isLens ? (mountId || null) : null,
        sensorFormat: isLens ? null : (sensorFormat || null),
        lensTypeCode: isLens ? (lensTypeCode || null) : null,
        lensRangeCode: isLens ? (lensRangeCode || null) : null,
        focalLengthMinMm: isLens && focalMin ? Number(focalMin) : null,
        focalLengthMaxMm: isLens && focalMax ? Number(focalMax) : null,
        msrpMinor: msrp ? Math.round(Number(msrp) * 100) : null,
      })
      setSaved(m.name)
      setName(''); setMountId(''); setSensorFormat(''); setLensTypeCode(''); setLensRangeCode('')
      setFocalMin(''); setFocalMax(''); setMsrp('')
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work')
    } finally { setBusy(false) }
  }

  const brandName = brands.find((b) => b.id === brandId)?.name

  return (
    <div className="st__card">
      <h3 className="st__card-title">Add a model to a brand</h3>
      <p className="st__muted">It becomes consignable straight away. The full name only — the brand is added in front for you.</p>
      <div className="st__form">
        <label className="st__f">
          <span>Brand *</span>
          <select className="tg-select" value={brandId} onChange={(e) => { setBrandId(e.target.value); setSaved(null) }}>
            <option value="">Select a brand</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="st__f">
          <span>Category *</span>
          <select className="tg-select" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSaved(null) }}>
            <option value="">Select a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="st__f st__f--wide">
          <span>Model name *</span>
          <input className="tg-input" placeholder={brandName ? `e.g. ${brandName === 'Canon' ? 'EOS R5 Mark II' : 'the model, as printed on it'}` : 'e.g. EOS R5 Mark II'}
            value={name} maxLength={120} onChange={(e) => { setName(e.target.value); setSaved(null) }} />
          {brandName && name.trim() && <small className="st__muted">Will be listed as “{brandName} {name.trim()}”.</small>}
        </label>

        {isLens ? (
          <>
            <label className="st__f">
              <span>Mount</span>
              <select className="tg-select" value={mountId} onChange={(e) => setMountId(e.target.value)}>
                <option value="">Not sure / any</option>
                {mounts.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label className="st__f">
              <span>Lens type</span>
              <select className="tg-select" value={lensTypeCode} onChange={(e) => setLensTypeCode(e.target.value)}>
                <option value="">—</option>
                {lensTypes.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </label>
            <label className="st__f">
              <span>Reach</span>
              <select className="tg-select" value={lensRangeCode} onChange={(e) => setLensRangeCode(e.target.value)}>
                <option value="">—</option>
                {lensRanges.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </label>
            <label className="st__f">
              <span>Focal length (mm)</span>
              <span className="st__field">
                <input className="tg-input st__input" inputMode="numeric" placeholder="min" value={focalMin} onChange={(e) => setFocalMin(e.target.value)} style={{ width: 70 }} />
                <span className="st__muted">to</span>
                <input className="tg-input st__input" inputMode="numeric" placeholder="max" value={focalMax} onChange={(e) => setFocalMax(e.target.value)} style={{ width: 70 }} />
              </span>
            </label>
          </>
        ) : (
          <label className="st__f">
            <span>Sensor format</span>
            <select className="tg-select" value={sensorFormat} onChange={(e) => setSensorFormat(e.target.value)}>
              <option value="">—</option>
              {sensorFormats.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </label>
        )}

        <label className="st__f">
          <span>Launch price (₹, optional)</span>
          <input className="tg-input" inputMode="decimal" placeholder="e.g. 329990" value={msrp} onChange={(e) => setMsrp(e.target.value)} />
        </label>
      </div>
      <div className="st__actions">
        <button className="tg-button tg-button--primary" disabled={!ready || busy} onClick={save}>
          {busy ? 'Adding…' : 'Add model'}
        </button>
        {saved && <span className="st__ok" role="status">Added “{saved}” — it is now consignable</span>}
      </div>
      {error && <p className="st__error" role="alert">{error}</p>}
    </div>
  )
}
