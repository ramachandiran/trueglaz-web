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
 * - The phone's font-size setting is honoured up to 1.3x. Past that the
 *   layout breaks (pills, rows and the tab bar have fixed shapes), and 1.3x
 *   is what the platform guidelines treat as large text.
 */
export const MAX_FONT_SCALE = 1.3
const DESIGN_WIDTH = 390

export function Txt({ style, maxFontSizeMultiplier = MAX_FONT_SCALE, ...rest }: TextProps) {
  const t = useTheme()
  const { width } = useWindowDimensions()
  const raw = StyleSheet.flatten(style)
  const k = Math.min(1, Math.max(0.84, width / DESIGN_WIDTH))
  const flat = raw && typeof raw.fontSize === 'number' && raw.fontSize >= 24 && k < 1
    ? { ...raw, fontSize: Math.round(raw.fontSize * k), lineHeight: typeof raw.lineHeight === 'number' ? Math.round(raw.lineHeight * k) : raw.lineHeight }
    : raw
  const usesThemeBodyFont = !flat?.fontFamily || flat.fontFamily === t.font.body
  const resolvedFamily = usesThemeBodyFont ? resolveMobileFont(flat?.fontWeight, flat?.fontSize) : flat.fontFamily

  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={[
        { fontFamily: resolveMobileBodyFont(undefined), color: t.colors.text },
        flat,
        usesThemeBodyFont ? { fontFamily: resolvedFamily, fontWeight: undefined } : null,
      ]}
    />
  )
}
