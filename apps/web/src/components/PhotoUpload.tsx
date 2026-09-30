import { useRef, useState } from 'react'
import { api, ApiError } from '@trueglaz/core'
import type { MediaView } from '@trueglaz/core'
import './PhotoUpload.css'

/**
 * Photographs, chosen and uploaded one at a time.
 *
 * Each file gets its own row and its own outcome. A batch that fails as a batch
 * tells a seller who picked eight photos that "the upload failed" and leaves
 * them to guess which one — so they upload in sequence and a rejection names
 * the file it was about.
 *
 * Sequential rather than parallel on purpose too: eight concurrent 12 MB PUTs
 * from a phone on mobile data is how you turn a slow upload into a failed one.
 */
export function PhotoUpload({
  ownerType, ownerId, role, defectId, max = 12, existing = [], onUploaded, hint,
}: {
  ownerType: 'item' | 'order' | 'kyc'
  ownerId: string
  role: string
  defectId?: string
  max?: number
  existing?: MediaView[]
  onUploaded?: (m: MediaView) => void
  hint?: string
}) {
  const [done, setDone] = useState<MediaView[]>(existing)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ name: string; index: number; of: number } | null>(null)
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([])
  const input = useRef<HTMLInputElement>(null)

  const room = max - done.length

  async function choose(files: FileList | null) {
    if (!files || files.length === 0) return
    const picked = Array.from(files).slice(0, room)
    setBusy(true)
    setErrors([])

    for (let i = 0; i < picked.length; i++) {
      const file = picked[i]
      setProgress({ name: file.name, index: i + 1, of: picked.length })
      try {
        const media = await api.uploadPhoto(file, { ownerType, ownerId, role, defectId })
        setDone((d) => (d.some((x) => x.id === media.id) ? d : [...d, media]))
        onUploaded?.(media)
      } catch (e) {
        // The API's message is written for the person who sent the file — it
        // says what to do about a HEIC or a photo that is too small — so it is
        // shown as it came rather than replaced with something generic.
        setErrors((x) => [...x, {
          name: file.name,
          message: e instanceof ApiError ? e.message : 'That file could not be uploaded',
        }])
      }
    }

    setProgress(null)
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="shots">
      {done.length > 0 && (
        <ul className="shots__grid">
          {done.map((m) => (
            <li key={m.id} className="shots__item">
              <img src={m.sizes[400] ?? m.url} alt="" loading="lazy" />
            </li>
          ))}
        </ul>
      )}

      <input
        ref={input}
        type="file"
        className="shots__input"
        /* JPEG and PNG only, and stated rather than left to `image/*`: on iOS
           an unrestricted picker hands over HEIC, which we cannot read, while
           naming the types here makes the phone convert on the way out. */
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy || room <= 0}
        onChange={(e) => choose(e.target.files)}
      />

      <p className="shots__hint tg-muted">
        {room <= 0
          ? `That is the maximum of ${max} photographs.`
          : hint ?? `Up to ${room} more. JPEG or PNG, 15 MB each.`}
      </p>

      {progress && (
        <p className="shots__busy" role="status">
          Uploading {progress.name} ({progress.index} of {progress.of})…
        </p>
      )}

      {errors.length > 0 && (
        <ul className="shots__errors">
          {errors.map((e) => (
            <li key={e.name}>
              <strong>{e.name}</strong> — {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
