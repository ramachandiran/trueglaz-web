import { StyleSheet, Text, type TextProps } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import { resolveMobileBodyFont } from '../theme/fonts'

/**
 * Text that honours the theme's font.
 *
 * On web `body { font-family: var(--tg-font) }` cascades to everything. React
 * Native has no cascade from View to Text, so without this the font token in
 * tokens.ts would silently do nothing on mobile — colours would retheme and
 * type would not. Callers still override freely; their style wins.
 */
export function Txt({ style, ...rest }: TextProps) {
  const t = useTheme()
  const flat = StyleSheet.flatten(style)
  const usesThemeBodyFont = !flat?.fontFamily || flat.fontFamily === t.font.body
  const resolvedFamily = usesThemeBodyFont ? resolveMobileBodyFont(flat?.fontWeight) : flat.fontFamily

  return (
    <Text
      {...rest}
      style={[
        { fontFamily: resolveMobileBodyFont(undefined), color: t.colors.text },
        flat,
        usesThemeBodyFont ? { fontFamily: resolvedFamily, fontWeight: undefined } : null,
      ]}
    />
  )
}
