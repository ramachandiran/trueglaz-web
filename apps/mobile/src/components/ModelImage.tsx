import { useEffect, useMemo, useState } from 'react'
import { Image, View, type StyleProp, type ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, type MediaView, type ModelImageEntry } from '@trueglaz/core'
import { API_ORIGIN } from '../config'
import { useTheme } from '../theme/ThemeContext'

/**
 * The admin-set model picture — the one image per catalogue model, uploaded in
 * Admin → Settings → Models — wherever the app shows a piece of gear.
 *
 * Media links come back relative from a local API (`/api/v1/media/…`) and
 * absolute from staging and production, where photos are served by the CDN
 * (`https://demo.trueglaz.com/media/…`). Prefixing API_ORIGIN to an absolute
 * link produced a broken address, so every picture went blank on staging.
 */
export function mediaUri(url: string): string {
  return /^https?:\/\//i.test(url) ? url : API_ORIGIN + url
}

/**
 * The smallest stored rendition at least `want` pixels wide (200, 400, 1200 or
 * 2400). A 100-point tile on a 3× phone needs 300 px, not the 2400 px original
 * the screens used to download on mobile data.
 */
export function sizedUri(m: MediaView, want: number): string {
  const widths = Object.keys(m.sizes ?? {}).map(Number).sort((a, b) => a - b)
  const w = widths.find((x) => x >= want) ?? widths[widths.length - 1]
  return mediaUri((w != null ? m.sizes[w] : undefined) ?? m.url)
}

// One fetch per app session, shared by every screen.
let cached: ModelImageEntry[] | null = null
let inflight: Promise<ModelImageEntry[]> | null = null
function load(): Promise<ModelImageEntry[]> {
  if (!inflight) {
    inflight = api.modelImages()
      .then((r) => (cached = r.models))
      .catch((e) => { inflight = null; throw e })
  }
  return inflight
}

/**
 * Look a model's picture up by catalogue slug or id. Placeholder drawings are
 * included, exactly as on the web, so both apps show the same picture.
 */
export function useModelImages() {
  const [list, setList] = useState<ModelImageEntry[] | null>(cached)
  useEffect(() => {
    let live = true
    if (!cached) load().then((l) => { if (live) setList(l) }).catch(() => {})
    return () => { live = false }
  }, [])
  return useMemo(() => {
    const real = list ?? []
    const bySlug = new Map(real.map((m) => [m.slug, m.image] as const))
    const byId = new Map(real.map((m) => [m.modelId, m.image] as const))
    return {
      bySlug: (slug?: string | null) => (slug ? bySlug.get(slug) ?? null : null),
      byId: (id?: string | null) => (id ? byId.get(id) ?? null : null),
    }
  }, [list])
}

/**
 * A square picture slot: the model picture on white, whole and never cropped
 * (a lens with its mount cut off no longer shows what it is), or a camera icon
 * when the model has no picture yet.
 */
export function ModelThumb({ image, size, want = 200, style }: {
  image: MediaView | null | undefined
  size: number
  /** Rendition width to fetch; defaults to the small one. */
  want?: number
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const [failed, setFailed] = useState(false)
  const show = image && !failed
  return (
    <View style={[{
      width: size, height: size, borderRadius: Math.round(size / 4), overflow: 'hidden',
      backgroundColor: show ? '#ffffff' : t.colors.bgSunken, borderWidth: 1, borderColor: t.colors.border,
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      {show
        ? <Image source={{ uri: sizedUri(image, want) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" onError={() => setFailed(true)} />
        : <Ionicons name="camera-outline" size={Math.round(size * 0.46)} color={t.colors.brand} />}
    </View>
  )
}
