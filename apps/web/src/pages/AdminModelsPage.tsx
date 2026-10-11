import { useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError, dateOnly, useApi, type AdminModelRow, type MediaView, type ModelImageHistory } from '@trueglaz/core'
import { GearPhoto } from '../components/GearPhoto'
import { refreshModelImages } from '../components/modelImages'
import { ErrorNote, Loading } from '../components/ui'
import './AdminModelsPage.css'

const MIN_EDGE = 800
type Show = 'needs' | 'all' | 'photo'

/**
 * Model photos: the picture of each catalogue model, set by an admin.
 *
 * One picture per model, shown wherever the model appears in the shop and the
 * back office. Replacing keeps the old one, so "Restore previous" undoes a bad
 * upload; "Remove" goes back to the drawn placeholder. The old bundled drawings
 * count as placeholders, so the progress bar tells the truth about what still
 * needs a photograph.
 */
export function AdminModelsPage() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [show, setShow] = useState<Show>('needs')
  const [bulkOpen, setBulkOpen] = useState(false)

  // Typing searches after a pause, not on every key.
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 250); return () => clearTimeout(t) }, [q])

  const list = useApi(() => api.adminModels({ q: query, brand, category, show: show === 'photo' ? 'photo' : show }), [query, brand, category, show])
  const all = useApi(() => api.adminModels({}), [])

  async function changed() {
    list.reload(); all.reload()
    await refreshModelImages()
  }

  const counts = all.data?.counts ?? list.data?.counts
  const pct = counts && counts.total > 0 ? Math.round((counts.photo / counts.total) * 100) : 0

  return (
    <div className="am">
      <header className="am__head">
        <div>
          <h1 className="am__title">Model photos</h1>
          <p className="am__lede">
            One picture per model, shown wherever that model appears — the shop, orders, the Wanted board and the
            consignment form. Use your own photographs: the whole model, on a plain light background.
          </p>
        </div>
        <button className="tg-button tg-button--primary" onClick={() => setBulkOpen((o) => !o)}>
          {bulkOpen ? 'Close bulk upload' : 'Upload many at once'}
        </button>
      </header>

      {counts && (
        <section className="am__progress" aria-label="Progress">
          <div className="am__bar" role="progressbar" aria-valuenow={counts.photo} aria-valuemin={0} aria-valuemax={counts.total}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p>
            <strong>{counts.photo}</strong> of {counts.total} models have a photograph ·{' '}
            <span className="am__tag am__tag--placeholder">{counts.placeholder} old drawings</span>{' '}
            <span className="am__tag am__tag--missing">{counts.missing} with nothing</span>
          </p>
        </section>
      )}

      {bulkOpen && all.data && <BulkUpload models={all.data.models} onDone={changed} />}

      <div className="am__tools">
        <input className="tg-input am__search" type="search" placeholder="Search models (e.g. R5 Mark II)" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="tg-select" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Brand">
          <option value="">All brands</option>
          {(all.data?.brands ?? []).map((b) => <option key={b}>{b}</option>)}
        </select>
        <Seg value={category} onChange={setCategory} options={[['', 'All'], ['cameras', 'Cameras'], ['lenses', 'Lenses']]} label="Type" />
        <Seg value={show} onChange={(v) => setShow(v as Show)} options={[['needs', 'Needs a photo'], ['photo', 'Has a photo'], ['all', 'All']]} label="Show" />
      </div>

      {list.loading && !list.data && <Loading label="Loading models" />}
      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
      {list.data && (
        list.data.models.length === 0 ? (
          <p className="am__empty">{show === 'needs' ? 'Every model here has a photograph. ' : 'No models match. '}Try another filter.</p>
        ) : (
          <ul className="am__grid">
            {list.data.models.map((m) => <ModelCard key={m.id} m={m} onChanged={changed} />)}
          </ul>
        )
      )}
    </div>
  )
}

function Seg({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: [string, string][]; label: string }) {
  return (
    <div className="am__seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- one model --

function ModelCard({ m, onChanged }: { m: AdminModelRow; onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ file: File; url: string; w: number; h: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<ModelImageHistory[] | null>(null)
  const kind = m.category === 'lenses' ? 'lens' : 'camera'
  const state = !m.image ? 'missing' : m.placeholder ? 'placeholder' : 'photo'

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  async function choose(file: File | undefined) {
    setError(null)
    if (!file) return
    const checked = await checkImage(file)
    if ('error' in checked) { setError(checked.error); return }
    setPreview({ file, ...checked })
  }

  async function run(what: () => Promise<unknown>) {
    setBusy(true); setError(null)
    try {
      await what()
      setPreview(null); setHistory(null)
      onChanged()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not work — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`am__card am__card--${state}`}>
      <div className="am__frame">
        {preview ? <img src={preview.url} alt={`New picture for ${m.name}`} />
          : m.image ? <img src={pick(m.image)} alt={m.name} loading="lazy" />
            : <GearPhoto kind={kind} size="hero" alt={m.name} />}
        <span className={`am__state am__state--${preview ? 'new' : state}`}>
          {preview ? 'Preview — not saved' : state === 'photo' ? 'Photo' : state === 'placeholder' ? 'Old drawing' : 'No picture'}
        </span>
      </div>

      <div className="am__body">
        <p className="am__brand">{m.brand} · {m.categoryName === 'Lenses' ? 'Lens' : 'Camera'}</p>
        <h2 className="am__name">{m.name}</h2>
        <p className="am__meta">
          {m.liveListings > 0 ? `${m.liveListings} on sale now` : 'None on sale'}
          {m.updatedAt && !m.placeholder && ` · set ${dateOnly(m.updatedAt)}${m.updatedBy ? ` by ${m.updatedBy}` : ''}`}
        </p>

        {preview ? (
          <div className="am__preview">
            <p className="am__hint">
              {preview.w}×{preview.h}. This is how it will look in the shop and as a thumbnail:
            </p>
            <div className="am__sizes">
              <span className="am__tile"><img src={preview.url} alt="" /></span>
              <span className="am__thumb"><img src={preview.url} alt="" /></span>
            </div>
            <div className="am__actions">
              <button className="tg-button tg-button--primary" disabled={busy}
                onClick={() => run(() => api.uploadPhoto(preview.file, { ownerType: 'model', ownerId: m.id, role: 'model_image' }))}>
                {busy ? 'Saving…' : m.image ? 'Replace picture' : 'Save picture'}
              </button>
              <button className="tg-button" disabled={busy} onClick={() => setPreview(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="am__actions">
            <button className="tg-button tg-button--primary" disabled={busy} onClick={() => input.current?.click()}>
              {m.image && !m.placeholder ? 'Replace' : 'Upload'}
            </button>
            {m.previousCount > 0 && (
              <button className="tg-button" disabled={busy} onClick={() => run(() => api.restoreModelImage(m.id))}>Restore previous</button>
            )}
            {m.image && (
              <button className="tg-button am__danger" disabled={busy}
                onClick={() => { if (window.confirm(`Remove the picture of ${m.name}? It can be restored later.`)) void run(() => api.removeModelImage(m.id)) }}>
                Remove
              </button>
            )}
            <button className="am__link" onClick={async () => setHistory(history ? null : await api.modelImageHistory(m.id))}>
              {history ? 'Hide history' : 'History'}
            </button>
          </div>
        )}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden
          onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = '' }} />
        {error && <p className="am__error" role="alert">{error}</p>}

        {history && (
          <ol className="am__history">
            {history.length === 0 && <li className="am__hint">Nothing yet.</li>}
            {history.map((h) => (
              <li key={h.id}>
                {h.image && <img src={pick(h.image)} alt="" />}
                <span>
                  <strong>{h.retiredAt ? WHY[h.retiredReason ?? 'replaced'] : 'Current'}</strong>
                  {h.placeholder && ' · old drawing'}
                  <br />
                  <span className="am__hint">
                    {h.uploadedAt && dateOnly(h.uploadedAt)}{h.uploadedBy ? ` by ${h.uploadedBy}` : h.placeholder ? ' (moved from the web app)' : ''}
                    {h.retiredAt && ` · ${dateOnly(h.retiredAt)}${h.retiredBy ? ` by ${h.retiredBy}` : ''}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </li>
  )
}

const WHY: Record<string, string> = { replaced: 'Replaced', removed: 'Removed', restored_other: 'Swapped for an earlier one' }

// ---------------------------------------------------------------- many at once --

type BulkRow = { file: File; model: AdminModelRow | null; status: 'ready' | 'uploading' | 'done' | 'error' | 'skipped'; note?: string }

/**
 * Drop a folder's worth of pictures named after their models
 * (canon-eos-r5-mark-ii.png, or "Canon EOS R5 Mark II.jpg"; JPEG, PNG or WebP). Each is matched to
 * its model by name; anything that does not match is listed, never guessed.
 */
function BulkUpload({ models, onDone }: { models: AdminModelRow[]; onDone: () => void }) {
  const [rows, setRows] = useState<BulkRow[]>([])
  const [running, setRunning] = useState(false)
  const [over, setOver] = useState(false)
  const bySlug = useMemo(() => new Map(models.map((m) => [m.slug, m])), [models])

  function add(files: FileList | null) {
    if (!files) return
    const next = Array.from(files).filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name)).map((file): BulkRow => {
      const model = bySlug.get(slugOf(file.name)) ?? null
      return { file, model, status: model ? 'ready' : 'skipped', note: model ? undefined : 'No model with this name' }
    })
    setRows((r) => [...r, ...next])
  }

  async function start() {
    setRunning(true)
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (r.status !== 'ready' || !r.model) continue
      setRows((all) => all.map((x, j) => (j === i ? { ...x, status: 'uploading' } : x)))
      const checked = await checkImage(r.file)
      let patch: Partial<BulkRow>
      if ('error' in checked) patch = { status: 'error', note: checked.error }
      else {
        URL.revokeObjectURL(checked.url)
        try {
          await api.uploadPhoto(r.file, { ownerType: 'model', ownerId: r.model.id, role: 'model_image' })
          patch = { status: 'done' }
        } catch (e) {
          patch = { status: 'error', note: e instanceof ApiError ? e.message : 'Upload failed' }
        }
      }
      setRows((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)))
    }
    setRunning(false)
    onDone()
  }

  const ready = rows.filter((r) => r.status === 'ready').length

  return (
    <section className="am__bulk" aria-label="Upload many at once">
      <label
        className={`am__drop${over ? ' am__drop--over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
      >
        <input type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
        <strong>Drop photos here, or click to choose</strong>
        <span>Name each file after its model — <code>canon-eos-r5-mark-ii.png</code> or <code>Canon EOS R5 Mark II.jpg</code>.
          JPEG, PNG or WebP, at least {MIN_EDGE}px on the long edge. Each replaces that model's current picture.</span>
      </label>

      {rows.length > 0 && (
        <>
          <table className="am__table">
            <thead><tr><th>File</th><th>Model</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`am__row--${r.status}`}>
                  <td className="tg-mono">{r.file.name}</td>
                  <td>{r.model ? `${r.model.brand} ${r.model.name}` : '—'}</td>
                  <td>{STATUS[r.status]}{r.note && <span className="am__hint"> · {r.note}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="am__actions">
            <button className="tg-button tg-button--primary" disabled={running || ready === 0} onClick={start}>
              {running ? 'Uploading…' : `Upload ${ready} matched`}
            </button>
            <button className="tg-button" disabled={running} onClick={() => setRows([])}>Clear</button>
          </div>
        </>
      )}
    </section>
  )
}

const STATUS: Record<BulkRow['status'], string> = { ready: 'Ready', uploading: 'Uploading…', done: 'Done', error: 'Failed', skipped: 'Skipped' }

// ---------------------------------------------------------------- helpers --

/** "Canon EOS R5 Mark II (1).JPG" -> "canon-eos-r5-mark-ii" */
function slugOf(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/\(\d+\)$/, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Reads the picture's size in the browser, so a too-small one is turned away before it is sent. */
function checkImage(file: File): Promise<{ url: string; w: number; h: number } | { error: string }> {
  // Some systems hand over a file with no type at all; the extension then decides, and the server checks the bytes.
  const typed = /^image\/(jpeg|pjpeg|png|x-png|webp)$/.test(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name))
  if (!typed) return Promise.resolve({ error: 'Use a JPEG, PNG or WebP picture' })
  if (file.size > 15 * 1024 * 1024) return Promise.resolve({ error: 'That file is over 15 MB' })
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight
      if (Math.max(w, h) < MIN_EDGE) { URL.revokeObjectURL(url); resolve({ error: `That picture is ${w}×${h}; it needs to be at least ${MIN_EDGE}px on its long edge` }) }
      else resolve({ url, w, h })
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ error: 'That file could not be read as a picture' }) }
    img.src = url
  })
}

function pick(m: MediaView): string {
  const widths = Object.keys(m.sizes).map(Number).sort((a, b) => a - b)
  const w = widths.find((x) => x >= 400) ?? widths[widths.length - 1]
  return (w != null ? m.sizes[w] : undefined) ?? m.url
}
