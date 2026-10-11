import { useEffect, useState } from 'react'
import { api, type ModelImageEntry } from '@trueglaz/core'

/**
 * Every model's picture, read once per page load and shared by every
 * ModelPhoto on the page. Two hundred-odd small entries, so one request beats
 * one per tile, and a model looks the same wherever it appears.
 *
 * Keyed by both the model's id and its slug, because screens know one or the
 * other.
 */
type Index = Map<string, ModelImageEntry>

let index: Index | null = null
let loading: Promise<Index> | null = null
const listeners = new Set<(i: Index) => void>()

function load(): Promise<Index> {
  if (!loading) {
    loading = api.modelImages()
      .then((r) => {
        const m: Index = new Map()
        for (const e of r.models) { m.set(e.modelId, e); m.set(e.slug, e) }
        index = m
        listeners.forEach((fn) => fn(m))
        return m
      })
      .catch(() => {
        // No pictures is a page that still works (placeholders); try again next time.
        loading = null
        const empty: Index = new Map()
        index = index ?? empty
        return index
      })
  }
  return loading
}

/** After an admin changes a picture: fetch again and redraw every ModelPhoto showing it. */
export function refreshModelImages(): Promise<Index> {
  loading = null
  return load()
}

/**
 * The picture for a model id or slug: the entry, null when the model has none,
 * or undefined while the list is still loading (so a tile can hold its space
 * rather than flash the placeholder first).
 */
export function useModelImage(key: string | null | undefined): ModelImageEntry | null | undefined {
  const [i, setI] = useState<Index | null>(index)
  useEffect(() => {
    listeners.add(setI)
    if (!index) void load()
    return () => { listeners.delete(setI) }
  }, [])
  if (!key) return null
  if (!i) return undefined
  return i.get(key) ?? null
}
