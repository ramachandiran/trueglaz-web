import Constants from 'expo-constants'

/**
 * Where the API lives. Native fetch has no same-origin fallback and no dev
 * proxy, so the absolute origin must be configured. Precedence:
 *   1. EXPO_PUBLIC_API_ORIGIN — set it per shell/device without editing files.
 *   2. app.json → expo.extra.apiOrigin — the committed default (the demo box).
 *
 * On a physical device the API must be reachable from the phone — a laptop-hosted
 * API needs the laptop's LAN address, not `localhost`.
 */
export const API_ORIGIN: string =
  process.env.EXPO_PUBLIC_API_ORIGIN ??
  (Constants.expoConfig?.extra as { apiOrigin?: string } | undefined)?.apiOrigin ??
  'http://3.104.55.164'
