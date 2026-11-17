import { useEffect, useState } from 'react'
import { Linking, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { api } from '@trueglaz/core'
import { openLink } from './linking'

/**
 * Push notifications on this phone, through Firebase.
 *
 * The API sends a push for the same events as the bell in the app; this side
 * asks permission at a moment it makes sense (after an order, after asking for
 * an insurance quote, or from Notification settings — never on first launch),
 * hands the phone's token to the API, and opens the right screen when a push is
 * tapped. Signing out takes the token back, so a shared phone stops getting the
 * last person's pushes.
 */

const TOKEN_KEY = 'trueglaz.pushToken'
/** Set when the person switched push off here, so the next launch does not quietly switch it back on. */
const OFF_KEY = 'trueglaz.pushOff'

/** One Android channel per kind of message, so people can mute one in system settings. */
const CHANNELS: { id: string; name: string; importance: Notifications.AndroidImportance }[] = [
  { id: 'buying', name: 'Orders and buying', importance: Notifications.AndroidImportance.HIGH },
  { id: 'selling', name: 'Selling', importance: Notifications.AndroidImportance.HIGH },
  { id: 'payouts', name: 'Payouts', importance: Notifications.AndroidImportance.HIGH },
  { id: 'security', name: 'Security alerts', importance: Notifications.AndroidImportance.MAX },
  { id: 'rewards', name: 'Rewards and offers', importance: Notifications.AndroidImportance.DEFAULT },
]

/** Firebase is only in builds that had google-services.json; web and simulators cannot push. */
export const pushSupported: boolean =
  Platform.OS !== 'web' && Device.isDevice &&
  !!(Constants.expoConfig?.extra as { pushReady?: boolean } | undefined)?.pushReady

export type PushState = 'unsupported' | 'undetermined' | 'granted' | 'denied'

let configured = false
function configure() {
  if (configured || Platform.OS === 'web') return
  configured = true
  // Shown as a banner while the app is open too: it is news the person asked for.
  Notifications.setNotificationHandler({
    // Only asked while the app is open: our own banner shows it then (TG-123),
    // so the phone's would be a second copy. It still goes in the tray.
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
  })
  if (Platform.OS === 'android') {
    for (const c of CHANNELS) {
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name, importance: c.importance, lightColor: '#FF6B35',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      }).catch(() => {})
    }
  }
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported) return 'unsupported'
  const p = await Notifications.getPermissionsAsync()
  if (p.granted) return 'granted'
  return p.canAskAgain ? 'undetermined' : 'denied'
}

/**
 * Make sure this phone gets pushes. With `ask`, shows the system prompt when the
 * person has not answered it yet; without, only registers when already allowed.
 */
export async function enablePush(ask: boolean): Promise<PushState> {
  if (!pushSupported) return 'unsupported'
  configure()
  // A silent re-register at launch respects "off"; asking means they want it on.
  if (!ask && (await AsyncStorage.getItem(OFF_KEY).catch(() => null))) return pushState()
  if (ask) await AsyncStorage.removeItem(OFF_KEY).catch(() => {})
  let state = await pushState()
  if (state === 'undetermined' && ask) {
    const r = await Notifications.requestPermissionsAsync()
    state = r.granted ? 'granted' : r.canAskAgain ? 'undetermined' : 'denied'
  }
  if (state !== 'granted') return state
  try {
    const { data } = await Notifications.getDevicePushTokenAsync()
    await register(String(data))
  } catch { /* Firebase not reachable right now: tried again next launch */ }
  return state
}

async function register(token: string) {
  await api.registerPushDevice(token, Platform.OS === 'ios' ? 'ios' : 'android', Constants.expoConfig?.version ?? null)
  await AsyncStorage.setItem(TOKEN_KEY, token)
}

/**
 * Stop pushes to this phone: on sign-out, or when the person turns push off
 * here (`byChoice`), which is remembered so a relaunch does not undo it.
 */
export async function disablePush(byChoice = false) {
  if (byChoice) await AsyncStorage.setItem(OFF_KEY, '1').catch(() => {})
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY)
    if (token) await api.removePushDevice(token)
    await AsyncStorage.removeItem(TOKEN_KEY)
  } catch { /* signed out already, or offline: the server drops dead tokens itself */ }
}

/** Whether this phone is registered for pushes right now (allowed, and not switched off here). */
export async function pushIsOn(): Promise<boolean> {
  if (!pushSupported) return false
  if ((await pushState()) !== 'granted') return false
  return !!(await AsyncStorage.getItem(TOKEN_KEY).catch(() => null))
}

/** The system settings page for this app, where a "Don't allow" can be undone. */
export const openSystemSettings = () => Linking.openSettings()

/** Keep the icon badge in step with the unread count shown in the app. */
export function setBadge(count: number) {
  if (!pushSupported) return
  Notifications.setBadgeCountAsync(count).catch(() => {})
}

/**
 * While signed in: register silently if already allowed, follow token changes,
 * and open the right screen when a push is tapped (also when it launched the app).
 */
export function usePushWhileSignedIn(navigation: any) {
  useEffect(() => {
    if (!pushSupported) return
    configure()
    enablePush(false)
    const tokenSub = Notifications.addPushTokenListener((t) => { register(String(t.data)).catch(() => {}) })
    const open = (r: Notifications.NotificationResponse | null) => {
      const link = r?.notification.request.content.data?.link
      if (typeof link === 'string') openLink(navigation, link)
    }
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {})
    const tapSub = Notifications.addNotificationResponseReceivedListener(open)
    return () => { tokenSub.remove(); tapSub.remove() }
  }, [navigation])
}

/** Call [fn] when a push arrives while the app is open (to refresh counts). Returns an unsubscribe. */
export function onPushReceived(fn: () => void): () => void {
  if (!pushSupported) return () => {}
  const sub = Notifications.addNotificationReceivedListener(() => fn())
  return () => sub.remove()
}

/** The current permission state, refreshed when asked. */
export function usePushState(): [PushState | null, () => void] {
  const [state, setState] = useState<PushState | null>(null)
  const refresh = () => { pushState().then(setState).catch(() => setState('unsupported')) }
  useEffect(refresh, [])
  return [state, refresh]
}
