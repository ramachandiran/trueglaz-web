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

  /**
   * The brand colour used as a surface — the header and footer that frame every
   * page. Separate from `accent` because an accent has to stay legible ON the
   * page, which forces it light in dark mode; the brand bar is the page there,
   * and should not follow.
   */
  brand: string
  onBrand: string
  onBrandMuted: string

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

/**
 * TrueGlaz brand: deep slate blue #233E50 on warm paper #FFFEF3.
 *
 * The two brand colours are used as themselves — accent and page — and
 * everything else is derived from them so the palette reads as one decision
 * rather than a navy dropped onto a stock grey UI. Neutrals carry the paper's
 * warmth; text and muted text are the brand hue darkened, not black.
 */
export const light: Theme = {
  name: 'light',
  ...shared,
  colors: {
    bg: '#fffef3',
    bgRaised: '#ffffff',
    bgSunken: '#f3f1e1',
    bgHover: '#f3f1e1',

    text: '#1a2e3b',
    textMuted: '#50697a',
    textInverted: '#fffef3',

    border: '#e5e1cd',
    borderStrong: '#c7c2a9',

    accent: '#233e50',
    accentHover: '#33596f',
    accentSoft: '#dde6ec',
    onAccent: '#fffef3',

    brand: '#233e50',
    onBrand: '#fffef3',
    onBrandMuted: '#a9bdcb',

    good: '#2e7d53',
    goodSoft: '#ddefe3',
    warn: '#8a5a12',
    warnSoft: '#f7ebd3',
    bad: '#a8342a',
    badSoft: '#f7dfdb',

    stepDone: '#2e7d53',
    stepCurrent: '#233e50',
    stepUpcoming: '#bfbba4',
    stepDetour: '#8a5a12',
  },
}

/**
 * The same brand after dark: the navy becomes the page, the paper becomes the
 * text. #233E50 itself is too dark to read as an accent here, so the accent is
 * the same hue lifted into the light end of the scale.
 */
export const dark: Theme = {
  name: 'dark',
  ...shared,
  colors: {
    bg: '#101c24',
    bgRaised: '#17262f',
    bgSunken: '#1e323f',
    bgHover: '#1e323f',

    text: '#f3f1e4',
    textMuted: '#9aaab5',
    textInverted: '#101c24',

    border: '#2b4252',
    borderStrong: '#547082',

    accent: '#7fb0ce',
    accentHover: '#9ac3dc',
    accentSoft: '#1c3746',
    onAccent: '#0c171e',

    brand: '#1b3243',
    onBrand: '#f3f1e4',
    onBrandMuted: '#93a8b8',

    good: '#52b583',
    goodSoft: '#123528',
    warn: '#d9a441',
    warnSoft: '#3a2b10',
    bad: '#e8685c',
    badSoft: '#40191a',

    stepDone: '#52b583',
    stepCurrent: '#7fb0ce',
    stepUpcoming: '#547082',
    stepDetour: '#d9a441',
  },
}

/** Worked example of a full retheme: heavier paper, serif, tight corners. */
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
    bg: '#f6f2e4',
    bgRaised: '#fffef3',
    bgSunken: '#ebe6d3',
    bgHover: '#ebe6d3',

    text: '#22313b',
    textMuted: '#56646e',
    textInverted: '#fffef3',

    border: '#ddd6c1',
    borderStrong: '#bfb599',

    accent: '#233e50',
    accentHover: '#33596f',
    accentSoft: '#e0e6ea',
    onAccent: '#fffef3',

    brand: '#233e50',
    onBrand: '#fffef3',
    onBrandMuted: '#a9bdcb',

    good: '#2b7449',
    goodSoft: '#dff2e5',
    warn: '#8a5a12',
    warnSoft: '#f7ebd3',
    bad: '#a8342a',
    badSoft: '#f7dfdb',

    stepDone: '#2b7449',
    stepCurrent: '#233e50',
    stepUpcoming: '#bfb599',
    stepDetour: '#8a5a12',
  },
}

export const themes = { light, dark, midnight }
export type ThemeName = keyof typeof themes
