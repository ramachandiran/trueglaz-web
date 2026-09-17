import { Text, type TextProps } from 'react-native'
import { useTheme } from '../theme/ThemeContext'

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
  return <Text {...rest} style={[{ fontFamily: t.font.body, color: t.colors.text }, style]} />
}
