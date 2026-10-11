import { useState } from 'react'
import { STOCK_IMAGE_BADGE, STOCK_IMAGE_NOTE, type MediaView } from '@trueglaz/core'
import { GearPhoto } from './GearPhoto'
import { useModelImage } from './modelImages'
import './ModelPhoto.css'

/**
 * A catalogue model's picture, as set by an admin; the drawn placeholder when
 * it has none.
 *
 * Where it stands in for a unit being sold (a listing, an order, a seller's
 * item) it is labelled "Not this unit": a studio shot of a mint camera, shown
 * without comment against a used one, tells the buyer something false about
 * the thing in the box. Where it only names a model (the Wanted board, the
 * model picker), pass `badge={false}`.
 *
 * Exactly the same box as GearPhoto at every size, so swapping one for the
 * other never moves a layout.
 */
export function ModelPhoto({
  slug,
  modelId,
  kind,
  alt,
  size = 'tile',
  badge = true,
}: {
  slug?: string | null
  modelId?: string | null
  kind: 'camera' | 'lens' | 'gear'
  alt: string
  size?: 'mini' | 'thumb' | 'tile' | 'hero'
  badge?: boolean
}) {
  const entry = useModelImage(modelId ?? slug)
  const [failed, setFailed] = useState(false)

  if (entry === undefined) return <span className={`model-photo model-photo--${size} model-photo--loading`} aria-hidden="true" />
  if (!entry || failed) return <GearPhoto kind={kind} alt={alt} size={size} />

  const img = entry.image
  return (
    <span className={`model-photo model-photo--${size}`}>
      <img
        src={pick(img, size)}
        srcSet={srcSet(img)}
        sizes={size === 'mini' ? '40px' : size === 'thumb' ? '54px' : size === 'tile' ? '(max-width: 720px) 120px, 180px' : '(max-width: 860px) 100vw, 480px'}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
      />
      {badge && !entry.placeholder && (
        <span className="model-photo__badge" title={STOCK_IMAGE_NOTE}>{STOCK_IMAGE_BADGE}</span>
      )}
    </span>
  )
}

function pick(m: MediaView, size: string): string {
  const want = size === 'mini' || size === 'thumb' ? 200 : size === 'tile' ? 400 : 1200
  const widths = Object.keys(m.sizes).map(Number).sort((a, b) => a - b)
  const w = widths.find((x) => x >= want) ?? widths[widths.length - 1]
  return (w != null ? m.sizes[w] : undefined) ?? m.url
}

function srcSet(m: MediaView): string {
  return Object.entries(m.sizes).map(([w, url]) => `${url} ${w}w`).concat(m.width ? [`${m.url} ${m.width}w`] : []).join(', ')
}
