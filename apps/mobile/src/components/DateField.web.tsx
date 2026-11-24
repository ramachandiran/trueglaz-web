import { createElement } from 'react'
import { View } from 'react-native'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'
import { mobileFontFamily } from '../theme/fonts'
import type { DateFieldProps } from './dateField.shared'

/**
 * The browser build (used for development and previews): the browser's own
 * date picker, which the website uses too. The native picker has no web
 * version. Same props and the same `YYYY-MM-DD` value as the phone (TG-175).
 */
export function DateField({ label, value, onChange, minimumDate, maximumDate, hint }: DateFieldProps) {
  const t = useTheme()
  return (
    <View style={{ gap: t.space.x1 }}>
      {label && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{label}</Txt>}
      {createElement('input', {
        type: 'date', value, min: minimumDate, max: maximumDate, 'aria-label': label ?? 'Date',
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: {
          color: t.colors.text, backgroundColor: t.colors.bgRaised, border: `1px solid ${t.colors.borderInput}`,
          borderRadius: t.radius.md, padding: `${t.space.x3}px`, fontSize: t.size.md, fontFamily: mobileFontFamily.regular,
          colorScheme: t.name === 'light' ? 'light' : 'dark',
        },
      })}
      {hint && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{hint}</Txt>}
    </View>
  )
}
