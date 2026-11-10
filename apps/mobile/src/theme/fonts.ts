/**
 * The app's two type faces, the same split as the website:
 * - Inter for everything people read, compare and type (body, buttons, inputs, prices);
 * - Space Grotesk for display sizes only (screen titles, the big vault total), where it
 *   carries the brand.
 *
 * React Native needs one file per weight (no variable fonts on Android), and the name
 * here is the name the file is registered under in App.tsx.
 */
export const mobileFontFamily = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
} as const

export const mobileHeadingFamily = {
  medium: 'SpaceGrotesk-Medium',
  bold: 'SpaceGrotesk-Bold',
} as const

export const mobileFontAssets = {
  [mobileFontFamily.regular]: require('../../assets/fonts/Inter-Regular.ttf'),
  [mobileFontFamily.medium]: require('../../assets/fonts/Inter-Medium.ttf'),
  [mobileFontFamily.semibold]: require('../../assets/fonts/Inter-SemiBold.ttf'),
  [mobileFontFamily.bold]: require('../../assets/fonts/Inter-Bold.ttf'),
  [mobileHeadingFamily.medium]: require('../../assets/fonts/SpaceGrotesk-Medium.ttf'),
  [mobileHeadingFamily.bold]: require('../../assets/fonts/SpaceGrotesk-Bold.ttf'),
}

/** Text at or above this size is display type and uses the heading face. */
export const DISPLAY_SIZE = 22

function weightValue(weight: unknown) {
  if (typeof weight === 'number') return weight
  if (weight === 'normal' || weight == null) return 400
  if (weight === 'bold') return 700
  const parsed = Number(weight)
  return Number.isFinite(parsed) ? parsed : 400
}

/** The body face for a weight. The theme's "bold" is 650, which maps to SemiBold. */
export function resolveMobileBodyFont(weight: unknown) {
  const value = weightValue(weight)
  if (value >= 700) return mobileFontFamily.bold
  if (value >= 600) return mobileFontFamily.semibold
  if (value >= 500) return mobileFontFamily.medium
  return mobileFontFamily.regular
}

/** The heading face for a weight: titles are medium or bold, never regular. */
export function resolveMobileHeadingFont(weight: unknown) {
  return weightValue(weight) >= 600 ? mobileHeadingFamily.bold : mobileHeadingFamily.medium
}

/** The face a piece of text should use, from its size and weight. */
export function resolveMobileFont(weight: unknown, fontSize: unknown) {
  return typeof fontSize === 'number' && fontSize >= DISPLAY_SIZE
    ? resolveMobileHeadingFont(weight)
    : resolveMobileBodyFont(weight)
}
