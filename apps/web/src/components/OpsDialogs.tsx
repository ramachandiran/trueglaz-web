import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, COURIER_CHOICES, courierName, useApi, type ConsignmentItem } from '@trueglaz/core'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon, ICONS } from './StaffShell'
import './OpsDialogs.css'

/**
 * One popup for every action on the Operations screen (TG-210): what is about
 * to happen, the details it needs, and Cancel / the action. It runs the action
 * itself, keeps any refusal on screen, and closes only when it worked.
 */
export function ActionDialog({
  title, confirmLabel, destructive = false, ready = true, wide = false, run, onClose, onDone, children,
}: {
  title: string
  confirmLabel: string
  destructive?: boolean
  /** False until everything required is filled in. */
  ready?: boolean
  wide?: boolean
  run: () => Promise<unknown>
  onClose: () => void
  onDone?: () => void
  children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function confirm() {
    setBusy(true); setError(null)
    try { await run(); onDone?.(); onClose() } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'That did not work')
      setBusy(false)
    }
  }
  return (
    <ConfirmDialog open title={title} confirmLabel={confirmLabel} destructive={destructive} busy={busy}
      confirmDisabled={!ready} error={error} wide={wide} onConfirm={() => void confirm()} onCancel={onClose}>
      <div className="opsd">{children}</div>
    </ConfirmDialog>
  )
}

/** The record the action is about, as label / value pairs. */
export function Facts({ rows }: { rows: Array<[string, ReactNode] | false | null | undefined> }) {
  return (
    <dl className="opsd__facts">
      {rows.filter(Boolean).map((r) => { const [k, v] = r as [string, ReactNode]; return <div key={k}><dt>{k}</dt><dd>{v}</dd></div> })}
    </dl>
  )
}

/** A labelled field; [required] adds the marker and the word for screen readers. */
export function Field({ label, hint, required, children }: { label: string; hint?: ReactNode; required?: boolean; children: ReactNode }) {
  return (
    <label className="opsd__field">
      <span className="opsd__label">{label}{required && <span className="opsd__req" aria-hidden="true"> *</span>}</span>
      {children}
      {hint && <span className="opsd__hint">{hint}</span>}
    </label>
  )
}

/** A comment box; [min] characters when required. */
export function Comment({ value, onChange, label, placeholder, required, min = 3 }: {
  value: string; onChange: (v: string) => void; label: string; placeholder?: string; required?: boolean; min?: number
}) {
  return (
    <Field label={label} required={required} hint={required ? `At least ${min} characters.` : 'Optional.'}>
      <textarea className="tg-input opsd__text" rows={3} maxLength={1000} value={value} placeholder={placeholder}
        required={required} aria-required={required} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

const digits = (s: string) => {
  const d = s.replace(/\D/g, '')
  return d.length === 12 && d.startsWith('91') ? d.slice(2) : d
}
export const isMobile = (s: string) => /^[6-9]\d{9}$/.test(digits(s))

type Upload = { key: string; file: File; preview: string | null; progress: number; id?: string; error?: string }

/**
 * Receive a box into the hub (TG-210): where it goes, how it came (a courier
 * with its tracking number, or a person by hand with their name and phone), and
 * photos or video of it as it arrived. Nothing is received until all of that is
 * there; the server checks the same rules again.
 */
export function ReceiveDialog({ submissionId, title, seller, items, onClose, onDone }: {
  submissionId: string
  title: string
  seller: string
  items: ConsignmentItem[]
  onClose: () => void
  onDone: () => void
}) {
  const ships = useApi(() => api.submissionShipments(submissionId), [submissionId])
  const bins = useApi(() => api.storageBins(), [])
  const shipment = ships.data?.[0]
  const [bin, setBin] = useState('')
  const [method, setMethod] = useState<'courier' | 'handover'>('courier')
  const [courier, setCourier] = useState('')
  const [awb, setAwb] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [uploads, setUploads] = useState<Upload[]>([])
  const camera = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)

  // The label's courier and number, as a starting point; staff correct them if the box says otherwise.
  useEffect(() => {
    if (!shipment) return
    setCourier((c) => c || shipment.courierCode || '')
    setAwb((a) => a || shipment.trackingNumber || '')
  }, [shipment])
  // Previews are object URLs: let them go with the popup.
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  function add(list: FileList | null) {
    if (!list || !shipment) return
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Math.random()}`
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      if (preview) urls.current.push(preview)
      setUploads((u) => [...u, { key, file, preview, progress: 0 }])
      const set = (patch: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)))
      api.uploadIntakeEvidence(shipment.id, file, (p) => set({ progress: p }))
        .then((e) => set({ id: e.id, progress: 1 }))
        .catch((e) => set({ error: e instanceof ApiError ? e.message : 'Did not upload' }))
    }
  }

  const done = uploads.filter((u) => u.id)
  const pending = uploads.some((u) => !u.id && !u.error)
  const ready = !!shipment && !!bin && done.length > 0 && !pending && (method === 'courier'
    ? !!courier
    : name.trim().length >= 2 && isMobile(phone))

  return (
    <ActionDialog wide title={`Receive ${title}`} confirmLabel="Receive" ready={ready} onClose={onClose} onDone={onDone}
      run={() => api.receive(shipment!.id, {
        outcomes: {}, binCode: bin, notes: notes.trim() || null, arrivalMethod: method,
        courierCode: method === 'courier' ? courier : null, trackingNumber: method === 'courier' ? awb.trim() || null : null,
        handoverName: method === 'handover' ? name.trim() : null, handoverPhone: method === 'handover' ? digits(phone) : null,
        evidenceIds: done.map((u) => u.id!),
      })}>
      <Facts rows={[
        ['Seller', seller],
        ['In the box', items.map((i) => i.internalSku).join(', ')],
        shipment && ['Label', `${courierName(shipment.courierCode) ?? shipment.courierCode} · ${shipment.trackingNumber ?? 'no number'}`],
      ]} />

      <Field label="Hub location" required hint="Where the box is put on arrival.">
        <select className="tg-select" value={bin} onChange={(e) => setBin(e.target.value)} aria-required>
          <option value="">{bins.loading ? 'Loading locations…' : 'Choose a location…'}</option>
          {(bins.data ?? []).map((b) => <option key={b.id} value={b.code}>{b.zone ? `${b.zone} · ${b.code}` : b.code}</option>)}
        </select>
      </Field>

      <fieldset className="opsd__group">
        <legend className="opsd__label">How did it arrive?<span className="opsd__req" aria-hidden="true"> *</span></legend>
        <div className="opsd__seg" role="radiogroup">
          <label className={method === 'courier' ? 'on' : ''}><input type="radio" name="arrival" checked={method === 'courier'} onChange={() => setMethod('courier')} /> Courier</label>
          <label className={method === 'handover' ? 'on' : ''}><input type="radio" name="arrival" checked={method === 'handover'} onChange={() => setMethod('handover')} /> Handed over in person</label>
        </div>
        {method === 'courier' ? (
          <div className="opsd__row">
            <Field label="Courier" required>
              <select className="tg-select" value={courier} onChange={(e) => setCourier(e.target.value)} aria-required>
                <option value="">Choose…</option>
                {COURIER_CHOICES.map((c) => <option key={c} value={c}>{courierName(c)}</option>)}
              </select>
            </Field>
            <Field label="Tracking / AWB number">
              <input className="tg-input" value={awb} maxLength={60} onChange={(e) => setAwb(e.target.value)} />
            </Field>
          </div>
        ) : (
          <div className="opsd__row">
            <Field label="Name of the person" required>
              <input className="tg-input" value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} aria-required />
            </Field>
            <Field label="Their mobile number" required hint={phone && !isMobile(phone) ? '10 digits, starting 6–9.' : undefined}>
              <input className="tg-input" value={phone} inputMode="tel" maxLength={16} autoComplete="off" onChange={(e) => setPhone(e.target.value)}
                aria-required aria-invalid={!!phone && !isMobile(phone)} />
            </Field>
          </div>
        )}
      </fieldset>

      <fieldset className="opsd__group">
        <legend className="opsd__label">Photos or video of the box as it arrived<span className="opsd__req" aria-hidden="true"> *</span></legend>
        <div className="opsd__acts">
          <button type="button" className="c-btn c-btn--sm" disabled={!shipment} onClick={() => camera.current?.click()}><Icon d={ICONS.camera} /> Take a photo</button>
          <button type="button" className="c-btn c-btn--sm" disabled={!shipment} onClick={() => picker.current?.click()}>Add photos or video</button>
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
          <input ref={picker} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
        </div>
        {uploads.length > 0 && (
          <ul className="opsd__files">
            {uploads.map((u) => (
              <li key={u.key} className={u.error ? 'bad' : ''}>
                {u.preview ? <img src={u.preview} alt="" /> : <span className="opsd__vid" aria-hidden="true">▶</span>}
                <span className="opsd__fname">{u.file.name}<small>{u.error ?? (u.id ? 'Uploaded' : `Uploading… ${Math.round(u.progress * 100)}%`)}</small></span>
                <button type="button" className="opsd__x" aria-label={`Remove ${u.file.name}`} onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}><Icon d={ICONS.close} /></button>
              </li>
            ))}
          </ul>
        )}
        <span className="opsd__hint">At least one. Photos up to 25 MB, video up to 200 MB.</span>
      </fieldset>

      <Comment label="Note" value={notes} onChange={setNotes} placeholder="Anything about the condition of the box" />
    </ActionDialog>
  )
}
