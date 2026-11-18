import { StyleSheet, Text, useWindowDimensions, type TextProps } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import { resolveMobileBodyFont, resolveMobileFont } from '../theme/fonts'

/**
 * Text that honours the theme's font.
 *
 * On web `body { font-family: var(--tg-font) }` cascades to everything. React
 * Native has no cascade from View to Text, so without this the font token in
 * tokens.ts would silently do nothing on mobile — colours would retheme and
 * type would not. Callers still override freely; their style wins.
 *
 * Display sizes (titles, the big vault total) get the heading face, the way
 * h1/h2 do on the website; everything else is the body face.
 *
 * Fitting every phone (TG-124):
 * - Display sizes (24 and up) shrink on narrow screens, down to 84% at 330 dp
 *   wide, so a big title never wraps into three lines on a small Android or
 *   at a larger "Display size" setting.
 * - The phone's font-size setting is honoured up to 2x for reading text, the
 *   200% WCAG 1.4.4 asks for (TG-148; it was capped at 1.3x). Display sizes
 *   are already large and stop at 1.5x so a title does not take the screen.
 *   Things with a fixed shape that sit on a picture or in a tight spot (the
 *   badges on a photo, a count bubble) pass TIGHT_FONT_SCALE themselves;
 *   everything else grows: chips, rows and fields use minHeight, not height.
 */
export const MAX_FONT_SCALE = 2
export const DISPLAY_FONT_SCALE = 1.5
export const TIGHT_FONT_SCALE = 1.3

/**
 * True when the phone's text is set large (150% and up). Rows of three tiles
 * become one tile per line then: at 200% a word like "Orders" or an amount
 * like ₹48,070 no longer fits a third of the screen and breaks mid-word.
 */
export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= 1.5
}
const DESIGN_WIDTH = 390

export function Txt({ style, maxFontSizeMultiplier, ...rest }: TextProps) {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const raw = StyleSheet.flatten(style)
  const k = Math.min(1, Math.max(0.84, width / DESIGN_WIDTH))
  const flat = raw && typeof raw.fontSize === 'number' && raw.fontSize >= 24 && k < 1
    ? { ...raw, fontSize: Math.round(raw.fontSize * k), lineHeight: typeof raw.lineHeight === 'number' ? Math.round(raw.lineHeight * k) : raw.lineHeight }
    : raw
  const usesThemeBodyFont = !flat?.fontFamily || flat.fontFamily === t.font.body
  const resolvedFamily = usesThemeBodyFont ? resolveMobileFont(flat?.fontWeight, flat?.fontSize) : flat.fontFamily

  const display = typeof raw?.fontSize === 'number' && raw.fontSize >= 24
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (display ? DISPLAY_FONT_SCALE : MAX_FONT_SCALE)}
      {...rest}
      style={[
        { fontFamily: resolveMobileBodyFont(undefined), color: t.colors.text },
        flat,
        usesThemeBodyFont ? { fontFamily: resolvedFamily, fontWeight: undefined } : null,
      ]}
    />
  )
}
