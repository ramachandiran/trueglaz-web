import { useState } from 'react'
import { modelImage, STOCK_IMAGE_BADGE, STOCK_IMAGE_NOTE } from '@trueglaz/core'
import { GearPhoto } from './GearPhoto'
import './ModelPhoto.css'

/**
 * The catalogue's stock picture of a model, standing in for a unit that has no
 * photographs of its own.
 *
 * It is always labelled. A studio shot of a mint camera, shown without comment
 * against a used one, tells the buyer something false about the thing in the
 * box — and the grade is the whole product here. The badge is small but it is
 * never optional, which is why it lives in this component rather than being
 * left to each caller to remember.
 *
 * Falls through to [GearPhoto] when the model has no image shipped yet, so a
 * missing file degrades to the existing placeholder art rather than a broken
 * image icon.
 */
export function ModelPhoto({
  slug,
  kind,
  alt,
  size = 'tile',
}: {
  slug: string | null | undefined
  kind: 'camera' | 'lens' | 'gear'
  alt: string
  size?: 'thumb' | 'tile' | 'hero'
}) {
  const [failed, setFailed] = useState(false)
  const src = modelImage(slug)

  if (!src || failed) return <GearPhoto kind={kind} alt={alt} size={size} />

  return (
    <span className={`model-photo model-photo--${size}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
      />
      <span className="model-photo__badge" title={STOCK_IMAGE_NOTE}>{STOCK_IMAGE_BADGE}</span>
    </span>
  )
}
