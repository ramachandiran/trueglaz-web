import './GearPhoto.css'

/**
 * Where a photograph goes.
 *
 * The schema has `media` and `consignment_item_media`, but nothing uploads to
 * them or serves them yet, so there is no photograph to show. Drawing line art
 * of the right kind of gear is the honest placeholder: it fills the slot the
 * layout needs, reads as deliberate rather than broken, and is one `src` away
 * from being the real thing.
 */
export function GearPhoto({
  kind,
  size = 'tile',
  alt = '',
}: {
  kind: 'camera' | 'lens' | 'gear'
  size?: 'thumb' | 'tile' | 'hero'
  alt?: string
}) {
  return (
    <div className={`photo photo--${size}`} role="img" aria-label={alt || 'No photograph yet'}>
      {kind === 'camera' ? <CameraArt /> : kind === 'lens' ? <LensArt /> : <GearArt />}
      <span className="photo__note">Photo to come</span>
    </div>
  )
}

/** Resolves a category name to the art that suits it. */
export function photoKindFor(categoryName?: string | null): 'camera' | 'lens' | 'gear' {
  const name = (categoryName ?? '').toLowerCase()
  if (name.includes('camera')) return 'camera'
  if (name.includes('lens')) return 'lens'
  return 'gear'
}

function CameraArt() {
  return (
    <svg className="photo__art" viewBox="0 0 120 90" fill="none" aria-hidden="true">
      <rect x="8" y="22" width="104" height="58" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <path d="M38 22l7-10h30l7 10" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="60" cy="51" r="20" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="60" cy="51" r="11" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <circle cx="96" cy="33" r="3.5" fill="currentColor" opacity="0.7" />
    </svg>
  )
}

function LensArt() {
  return (
    <svg className="photo__art" viewBox="0 0 120 90" fill="none" aria-hidden="true">
      <rect x="22" y="18" width="76" height="54" rx="10" stroke="currentColor" strokeWidth="2.5" />
      <rect x="14" y="26" width="10" height="38" rx="3" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="72" cy="45" r="18" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="72" cy="45" r="9" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <path d="M34 30v30M42 30v30" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    </svg>
  )
}

function GearArt() {
  return (
    <svg className="photo__art" viewBox="0 0 120 90" fill="none" aria-hidden="true">
      <rect x="18" y="20" width="84" height="52" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="60" cy="46" r="16" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  )
}
