import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import type { Storage } from '@trueglaz/core'

/**
 * Where the app keeps what it remembers (TG-security round 2).
 *
 * The signed-in session is a bearer token: whoever holds it is the user for
 * thirty days. So it lives in the iPhone Keychain / Android Keystore through
 * SecureStore, encrypted by the device and left out of backups, rather than in
 * AsyncStorage, which is a plain file. Everything else (offline cache, small
 * preferences) is not a secret and stays in AsyncStorage.
 *
 * A session saved by an older build is moved across the first time it is read,
 * so nobody is signed out by the update.
 */
const SECRET_KEYS = new Set(['trueglaz.session'])

// Expo web (used for testing) has no Keychain; it keeps the old behaviour.
const secureAvailable = Platform.OS === 'ios' || Platform.OS === 'android'

const secure = {
  async get(key: string): Promise<string | null> {
    const saved = await SecureStore.getItemAsync(key)
    if (saved != null) return saved
    // Once: carry a session over from an older build, then delete the plain copy.
    const legacy = await AsyncStorage.getItem(key)
    if (legacy != null) {
      await SecureStore.setItemAsync(key, legacy, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY })
      await AsyncStorage.removeItem(key)
    }
    return legacy
  },
  async set(key: string, value: string) {
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY })
    await AsyncStorage.removeItem(key)
  },
  async remove(key: string) {
    await SecureStore.deleteItemAsync(key)
    await AsyncStorage.removeItem(key)
  },
}

export const nativeStorage: Storage = {
  async get(key) {
    try {
      return secureAvailable && SECRET_KEYS.has(key) ? await secure.get(key) : await AsyncStorage.getItem(key)
    } catch { return null }
  },
  async set(key, value) {
    try {
      if (secureAvailable && SECRET_KEYS.has(key)) await secure.set(key, value)
      else await AsyncStorage.setItem(key, value)
    } catch { /* ignore */ }
  },
  async remove(key) {
    try {
      if (secureAvailable && SECRET_KEYS.has(key)) await secure.remove(key)
      else await AsyncStorage.removeItem(key)
    } catch { /* ignore */ }
  },
}
