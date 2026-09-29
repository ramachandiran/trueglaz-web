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
export function PhotoPicker({ files, onChange, max = 12 }: {
  files: File[]
  onChange: (files: File[]) => void
  max?: number
}) {
  const [previews, setPreviews] = useState<string[]>([])
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [files])

  const room = max - files.length

  function add(picked: FileList | null) {
    if (!picked) return
    onChange([...files, ...Array.from(picked).slice(0, room)])
    if (input.current) input.current.value = ''
  }

  return (
    <div className="shots">
      {files.length > 0 && (
        <ul className="shots__grid">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="shots__item shots__item--removable">
              {previews[i] && <img src={previews[i]} alt="" />}
              <button
                type="button"
                className="shots__remove"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((_, n) => n !== i))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={input}
        type="file"
        className="shots__input"
        /* Named rather than `image/*`: on iOS an unrestricted picker hands over
           HEIC, which the server cannot read, while asking for these makes the
           phone convert on the way out. */
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={room <= 0}
        onChange={(e) => add(e.target.files)}
      />

      <p className="shots__hint tg-muted">
        {room <= 0
          ? `That is the maximum of ${max}.`
          : `At least one, up to ${max}. JPEG or PNG, 15 MB each. They upload when you send the form.`}
      </p>
    </div>
  )
}
