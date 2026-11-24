import { Linking } from 'react-native'
import * as ImagePicker from 'expo-image-picker'

export type PhotoSource = 'camera' | 'library'

export interface Picked {
  assets: ImagePicker.ImagePickerAsset[]
  /** Why nothing came back, in words for the seller. */
  error?: string
  /** Access was refused for good: only Settings can switch it back on. */
  needsSettings?: boolean
}

/**
 * Photos from the camera or the library (TG-187).
 *
 * The iPhone photo picker has no camera button (Android's does), so a screen
 * that only opened the library left iPhone users no way to take a picture.
 * Every photo button offers both now, through here.
 */
export async function pickPhotos(source: PhotoSource, opts: { multiple?: boolean; limit?: number; quality?: number } = {}): Promise<Picked> {
  const quality = opts.quality ?? 0.7
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      return perm.canAskAgain
        ? { assets: [], error: 'Allow camera access to take a photo.' }
        : { assets: [], error: 'Camera access is off for TrueGlaz. Switch it on in Settings.', needsSettings: true }
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality })
    return { assets: res.canceled ? [] : res.assets }
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) {
    return perm.canAskAgain
      ? { assets: [], error: 'Allow photo access to choose photos.' }
      : { assets: [], error: 'Photo access is off for TrueGlaz. Switch it on in Settings.', needsSettings: true }
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], quality,
    allowsMultipleSelection: !!opts.multiple, selectionLimit: opts.multiple ? opts.limit ?? 0 : 1,
  })
  return { assets: res.canceled ? [] : res.assets }
}

export const openSettings = () => { Linking.openSettings().catch(() => undefined) }
