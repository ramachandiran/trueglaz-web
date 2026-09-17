/* ===========================================================================
   THE THEME — one file, both platforms.
   ---------------------------------------------------------------------------
   React Native has no CSS custom properties, so the tokens live here as plain
   TypeScript and each platform consumes them its own way:

     web    -> `npm run tokens` generates apps/web/src/theme/tokens.generated.css
               from this file, and the stylesheets keep using var(--tg-*)
     mobile -> imports this object directly through useTheme()

   To retheme: copy `light`/`dark` below, change the VALUES, keep every KEY.
   `midnight` is a worked example. Nothing else in either app needs to change.
   =========================================================================== */

export interface ColorTokens {
  bg: string
  bgRaised: string
  bgSunken: string
  bgHover: string

  text: string
  textMuted: string
  textInverted: string

  border: string
  borderStrong: string

  accent: string
  accentHover: string
  accentSoft: string
  onAccent: string

  good: string
  goodSoft: string
  warn: string
  warnSoft: string
  bad: string
  badSoft: string

  /** Timeline roles, so the lifecycle graph can be recoloured on its own. */
  stepDone: string
  stepCurrent: string
  stepUpcoming: string
  stepDetour: string
}

export interface Theme {
  name: string
  colors: ColorTokens
  font: { body: string; mono: string }
  /** Numbers, not strings: React Native needs them unitless. */
  size: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number }
  weight: { normal: string; medium: string; bold: string }
  radius: { sm: number; md: number; lg: number; pill: number }
  space: { x1: number; x2: number; x3: number; x4: number; x5: number; x6: number; x7: number }
}

const shared = {
  font: {
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  size: { xs: 12, sm: 13, md: 15, lg: 18, xl: 24, xxl: 32 },
  weight: { normal: '400', medium: '500', bold: '650' },
  radius: { sm: 4, md: 8, lg: 12, pill: 999 },
  space: { x1: 4, x2: 8, x3: 12, x4: 16, x5: 24, x6: 32, x7: 48 },
}

export const light: Theme = {
  name: 'light',
  ...shared,
  colors: {
    bg: '#f3f5f8',
    bgRaised: '#ffffff',
    bgSunken: '#e6eaef',
    bgHover: '#e6eaef',

    text: '#0d1117',
    textMuted: '#6e7681',
    textInverted: '#ffffff',

    border: '#d0d7de',
    borderStrong: '#b1bac4',

    accent: '#1f6feb',
    accentHover: '#2f81f7',
    accentSoft: '#ddeaff',
    onAccent: '#ffffff',

    good: '#1a7f37',
    goodSoft: '#dcfce7',
    warn: '#9a6700',
    warnSoft: '#fff4d6',
    bad: '#cf222e',
    badSoft: '#ffebe9',

    stepDone: '#1a7f37',
    stepCurrent: '#1f6feb',
    stepUpcoming: '#b1bac4',
    stepDetour: '#9a6700',
  },
}

export const dark: Theme = {
  name: 'dark',
  ...shared,
  colors: {
    bg: '#0d1117',
    bgRaised: '#161b22',
    bgSunken: '#21262d',
    bgHover: '#21262d',

    text: '#e6eaef',
    textMuted: '#8b949e',
    textInverted: '#ffffff',

    border: '#30363d',
    borderStrong: '#6e7681',

    accent: '#2f81f7',
    accentHover: '#1f6feb',
    accentSoft: '#16304f',
    onAccent: '#ffffff',

    good: '#3fb950',
    goodSoft: '#133a1d',
    warn: '#d29922',
    warnSoft: '#3b2f0f',
    bad: '#f85149',
    badSoft: '#4a1a1a',

    stepDone: '#3fb950',
    stepCurrent: '#2f81f7',
    stepUpcoming: '#6e7681',
    stepDetour: '#d29922',
  },
}

/** Worked example of a full retheme: warm paper, violet accent, serif, tight corners. */
export const midnight: Theme = {
  name: 'midnight',
  ...shared,
  font: {
    body: '"Iowan Old Style", Georgia, ui-serif, serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  radius: { sm: 2, md: 4, lg: 6, pill: 999 },
  weight: { normal: '400', medium: '500', bold: '700' },
  colors: {
    bg: '#f6f1e8',
    bgRaised: '#fffdf9',
    bgSunken: '#ece4d6',
    bgHover: '#ece4d6',

    text: '#2a2320',
    textMuted: '#7a6e63',
    textInverted: '#fffdf9',

    border: '#ddd2c0',
    borderStrong: '#bfae95',

    accent: '#6d4aff',
    accentHover: '#5b39e8',
    accentSoft: '#e8e1ff',
    onAccent: '#ffffff',

    good: '#2f7d4f',
    goodSoft: '#dff2e5',
    warn: '#a86a15',
    warnSoft: '#fbeed6',
    bad: '#b93b30',
    badSoft: '#fbe3e0',

    stepDone: '#2f7d4f',
    stepCurrent: '#6d4aff',
    stepUpcoming: '#bfae95',
    stepDetour: '#a86a15',
  },
}

export const themes = { light, dark, midnight }
export type ThemeName = keyof typeof themes
