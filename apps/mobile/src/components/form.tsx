import { ActivityIndicator, Pressable, TextInput, View, type TextInputProps } from 'react-native'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'
import { mobileFontFamily } from '../theme/fonts'

type Variant = 'primary' | 'cta' | 'ghost' | 'danger'

/** The one button, in four tones. `cta` is the warm buy button; keep it scarce. */
export function Button({
  label, onPress, variant = 'primary', disabled, loading, style,
}: {
  label: string; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; style?: object
}) {
  const t = useTheme()
  const map = {
    primary: { bg: t.colors.accent, fg: t.colors.onAccent, border: t.colors.accent },
    cta: { bg: t.colors.cta, fg: t.colors.onCta, border: t.colors.cta },
    ghost: { bg: 'transparent', fg: t.colors.text, border: t.colors.border },
    danger: { bg: 'transparent', fg: t.colors.bad, border: t.colors.bad },
  }[variant]
  const off = disabled || loading
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      style={[
        {
          flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
          paddingVertical: t.space.x3, paddingHorizontal: t.space.x4, borderRadius: t.radius.md,
          borderWidth: 1, backgroundColor: map.bg, borderColor: map.border, opacity: off ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={map.fg} />}
      <Txt style={{ color: map.fg, fontWeight: t.weight.bold as never, fontSize: t.size.md }}>{label}</Txt>
    </Pressable>
  )
}

/** A labelled text input that honours the theme. */
export function Field({ label, hint, style, ...rest }: TextInputProps & { label?: string; hint?: string }) {
  const t = useTheme()
  return (
    <View style={{ gap: t.space.x1 }}>
      {label && (
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{label}</Txt>
      )}
      <TextInput
        placeholderTextColor={t.colors.textMuted}
        style={[
          {
            color: t.colors.text, fontFamily: mobileFontFamily.regular, fontSize: t.size.md,
            backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border,
            borderRadius: t.radius.md, paddingHorizontal: t.space.x3, paddingVertical: t.space.x3,
          },
          style as object,
        ]}
        {...rest}
      />
      {hint && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{hint}</Txt>}
    </View>
  )
}
