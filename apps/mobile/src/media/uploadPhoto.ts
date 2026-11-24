import * as ImageManipulator from 'expo-image-manipulator'
import { api, type MediaView, type UploadTarget } from '@trueglaz/core'

/** Phone photos are often large HEIC files the server cannot read: send a JPEG at most 2000px wide. */
/**
 * `onProgress` runs 0 → 1 across the whole job, not just the bytes: preparing
 * the JPEG is the first tenth, the upload most of the rest, and the server's
 * check the last step, so a tile never sits at 100% while it is still busy.
 */
export async function uploadPhoto(
  asset: { uri: string; width?: number; height?: number },
  target: UploadTarget,
  onProgress?: (f: number) => void,
): Promise<MediaView> {
  const MAX_EDGE = 2000
  onProgress?.(0.03)
  const actions = asset.width && asset.width > MAX_EDGE ? [{ resize: { width: MAX_EDGE } }] : []
  const out = await ImageManipulator.manipulateAsync(asset.uri, actions, { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG })
  const blob = await (await fetch(out.uri)).blob()
  onProgress?.(0.12)
  const media = await api.uploadMedia(blob, 'image/jpeg', target, onProgress ? (f) => onProgress(0.12 + f * 0.83) : undefined)
  onProgress?.(1)
  return media
}
