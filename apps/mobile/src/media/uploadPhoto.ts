import * as ImageManipulator from 'expo-image-manipulator'
import { api, type MediaView, type UploadTarget } from '@trueglaz/core'

/** Phone photos are often large HEIC files the server cannot read: send a JPEG at most 2000px wide. */
export async function uploadPhoto(
  asset: { uri: string; width?: number; height?: number },
  target: UploadTarget,
): Promise<MediaView> {
  const MAX_EDGE = 2000
  const actions = asset.width && asset.width > MAX_EDGE ? [{ resize: { width: MAX_EDGE } }] : []
  const out = await ImageManipulator.manipulateAsync(asset.uri, actions, { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG })
  const blob = await (await fetch(out.uri)).blob()
  return api.uploadMedia(blob, 'image/jpeg', target)
}
