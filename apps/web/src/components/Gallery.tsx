import { useState } from 'react'
import type { MediaView } from '@trueglaz/core'
import { ModelPhoto } from './ModelPhoto'
import './Gallery.css'

/**
 * The photographs of one unit.
 *
 * Falls back to the drawn placeholder when there are none, which is most of the
 * catalogue for now — a unit reaches the shop floor before somebody has stood it
 * under the lights. The fallback keeps its own promise: the condition report is
 * the whole truth until the pictures land.
 */
export function Gallery({ photos, kind, alt, modelSlug }: {
  photos: MediaView[]
  kind: 'camera' | 'lens' | 'gear'
  alt: string
  /** The catalogue model, for the stock picture shown when there are no photos. */
  modelSlug?: string | null
}) {
  const [active, setActive] = useState(0)

  if (photos.length === 0) {
    return (
      <div className="product__gallery">
        {/* The stock picture shows what the model looks like; it is not and
            cannot be a picture of this unit, and the note below says so in
            as many words. On a page whose entire product is an honest grade,
            an unlabelled studio shot would be the one dishonest thing on it. */}
        <ModelPhoto slug={modelSlug} kind={kind} size="hero" alt={alt} />
        <p className="product__photo-note tg-muted">
          {modelSlug
            ? 'That is a stock picture of this model, not of this unit. Photographs of ' +
              'the actual item are coming; until then the condition report below is the ' +
              'whole truth about it.'
            : 'Photographs of this exact unit are coming. Until then the condition report ' +
              'below is the whole truth about it.'}
        </p>
      </div>
    )
  }

  const shown = photos[Math.min(active, photos.length - 1)]

  return (
    <div className="product__gallery">
      <div className="gallery__hero">
        <img
          src={shown.sizes[1200] ?? shown.url}
          /* The browser picks a width from what it knows about the layout and
             the screen, which is the whole point of storing several: a phone
             has no use for the 2400px rendition and pays for it in data. */
          srcSet={srcSet(shown)}
          sizes="(max-width: 860px) 100vw, 360px"
          alt={alt}
          width={shown.width ?? undefined}
          height={shown.height ?? undefined}
        />
      </div>

      {photos.length > 1 && (
        <ul className="product__thumbs gallery__thumbs">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={`gallery__thumb${i === active ? ' gallery__thumb--on' : ''}`}
                aria-label={`Photograph ${i + 1} of ${photos.length}`}
                aria-current={i === active}
                onClick={() => setActive(i)}
              >
                <img src={p.sizes[200] ?? p.url} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="product__photo-note tg-muted">
        {photos.length === 1 ? 'One photograph' : `${photos.length} photographs`} of this exact
        unit — not a stock image of the model.
      </p>
    </div>
  )
}

/** Every rendition we hold, so the browser can choose. */
export function srcSet(m: MediaView): string | undefined {
  const entries = Object.entries(m.sizes)
  if (entries.length === 0) return undefined
  return entries.map(([w, url]) => `${url} ${w}w`).join(', ')
}
