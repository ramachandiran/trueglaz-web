export const mobileFontFamily = {
  regular: 'SpaceGrotesk-Regular',
  medium: 'SpaceGrotesk-Medium',
  bold: 'SpaceGrotesk-Bold',
} as const

export const mobileFontAssets = {
  [mobileFontFamily.regular]: require('../../assets/fonts/SpaceGrotesk-Regular.ttf'),
  [mobileFontFamily.medium]: require('../../assets/fonts/SpaceGrotesk-Medium.ttf'),
  [mobileFontFamily.bold]: require('../../assets/fonts/SpaceGrotesk-Bold.ttf'),
}

function weightValue(weight: unknown) {
  if (typeof weight === 'number') return weight
  if (weight === 'normal' || weight == null) return 400
  if (weight === 'bold') return 700
  const parsed = Number(weight)
  return Number.isFinite(parsed) ? parsed : 400
}

export function resolveMobileBodyFont(weight: unknown) {
  const value = weightValue(weight)
  if (value >= 650) return mobileFontFamily.bold
  if (value >= 500) return mobileFontFamily.medium
  return mobileFontFamily.regular
}