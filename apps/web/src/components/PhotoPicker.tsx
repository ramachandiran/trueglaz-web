import { useEffect, useRef, useState } from 'react'
import './PhotoUpload.css'

/**
 * Photographs chosen before there is anything to attach them to.
 *
 * The submission form creates the unit and submits it in one action, so at the
 * moment a seller picks their photos the item does not exist yet and there is
 * no id to upload against. So this holds the files, shows them back, and hands
 * them over once the item has been created.
 *
 * Previews come from object URLs and are revoked on unmount. A form somebody
 * fills in slowly, changing their mind about which eight photos, otherwise
 * leaks a blob per discarded file for as long as the tab is open.
 */
export function PhotoPicker({ files, onChange }: {
  files: File[]
  onChange: (files: File[]) => void
}) {
  const [previews, setPreviews] = useState<string[]>([])
  const [dragging, setDragging] = useState<number | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [files])

  const slotCount = 4
  const room = slotCount - files.length

  function add(picked: FileList | File[] | null) {
    if (!picked) return
    const images = Array.from(picked).filter((file) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    )
    onChange([...files, ...images.slice(0, room)])
    if (input.current) input.current.value = ''
  }

  useEffect(() => {
    if (viewing === null) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setViewing(null)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [viewing])

  return (
    <div className="shots">
      <ul className="shots__grid">
        {Array.from({ length: slotCount }, (_, i) => {
          const file = files[i]
          return (
            <li
              key={file ? `${file.name}-${file.size}-${i}` : `empty-${i}`}
              className={`shots__slot${dragging === i ? ' shots__slot--dragging' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(i) }}
              onDragLeave={() => setDragging(null)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(null)
                add(event.dataTransfer.files)
              }}
            >
              {file && previews[i] ? (
                <>
                  <button
                    type="button"
                    className="shots__open"
                    onClick={() => setViewing(i)}
                    aria-label={`Preview ${file.name}`}
                  >
                    <img src={previews[i]} alt={file.name} />
                  </button>
                  <button
                    type="button"
                    className="shots__remove"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => {
                      onChange(files.filter((_, n) => n !== i))
                      setViewing(null)
                    }}
                  >
                    ×
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="shots__empty"
                  disabled={room <= 0}
                  onClick={() => input.current?.click()}
                >
                  <span aria-hidden="true">+</span>
                  <span>Add photo</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <input
        ref={input}
        type="file"
        className="shots__input"
        /* Named rather than `image/*`: on iOS an unrestricted picker hands over
           HEIC, which the server cannot read, while asking for these makes the
           phone convert on the way out. */
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => add(e.target.files)}
        disabled={room <= 0}
      />

      <p className="shots__hint tg-muted">
        {room <= 0
          ? `All ${slotCount} photo slots are filled.`
          : `Add up to ${slotCount} JPEG, PNG or WebP photos. They upload when you send the form.`}
      </p>

      {viewing !== null && previews[viewing] && (
        <div
          className="shots__lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${files[viewing]?.name ?? 'photo'}`}
          onClick={() => setViewing(null)}
        >
          <div className="shots__lightbox-content" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="shots__lightbox-close"
              aria-label="Close photo preview"
              onClick={() => setViewing(null)}
              autoFocus
            >
              ×
            </button>
            <img src={previews[viewing]} alt={files[viewing]?.name ?? 'Selected photo'} />
          </div>
        </div>
      )}
    </div>
  )
}
