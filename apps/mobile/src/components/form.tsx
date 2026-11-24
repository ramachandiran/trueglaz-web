import { useRef, type ElementRef } from 'react'
import { ActivityIndicator, Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native'
import { useRevealOnFocus } from './FormScroll'
import { MAX_FONT_SCALE, Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'
import { mobileFontFamily } from '../theme/fonts'

/**
 * danger: red outline, for a red action on a page (Withdraw item).
 * destructive: solid red, for the confirming button in a dialog (Delete, Remove).
 */
type Variant = 'primary' | 'cta' | 'ghost' | 'danger' | 'destructive'

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
    destructive: { bg: t.colors.bad, fg: t.colors.onBad, border: t.colors.bad },
  }[variant]
  const off = disabled || loading
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!off, busy: !!loading }}
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
/**
 * oneParagraph: wraps over several lines as it is typed, but Enter never adds
 * a line break — it moves on (onSubmitEditing), or closes the keyboard — and
 * pasted line breaks become spaces (TG-159).
 * fieldRef: the input itself, so the field before can move focus here.
 */
export function Field({ label, hint, style, onFocus, oneParagraph, fieldRef, onChangeText, ...rest }: TextInputProps & {
  label?: string; hint?: string; oneParagraph?: boolean; fieldRef?: React.MutableRefObject<ElementRef<typeof TextInput> | null>
}) {
  const t = useTheme()
  // Inside a FormScroll, a focused field is kept above the keyboard (TG-141).
  const input = useRef<ElementRef<typeof TextInput>>(null)
  const paragraph: Partial<TextInputProps> = oneParagraph ? {
    multiline: true,
    submitBehavior: rest.onSubmitEditing ? 'submit' : 'blurAndSubmit',
    returnKeyType: rest.onSubmitEditing ? 'next' : 'done',
    // The browser build only reads the older prop.
    ...(Platform.OS === 'web' ? { blurOnSubmit: true } : {}),
  } : {}
  const reveal = useRevealOnFocus()
  return (
    <View style={{ gap: t.space.x1 }}>
      {label && (
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{label}</Txt>
      )}
      <TextInput
        ref={(el) => { input.current = el; if (fieldRef) fieldRef.current = el }}
        onFocus={(e) => { reveal?.(input.current as never); onFocus?.(e) }}
        placeholderTextColor={t.colors.textMuted}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[
          {
            color: t.colors.text, fontFamily: mobileFontFamily.regular, fontSize: t.size.md,
            backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.borderInput,
            borderRadius: t.radius.md, paddingHorizontal: t.space.x3, paddingVertical: t.space.x3,
          },
          style as object,
        ]}
        {...paragraph}
        {...rest}
        onChangeText={oneParagraph && onChangeText ? (v) => onChangeText(v.replace(/[ \t]*[\r\n]+[ \t]*/g, ' ')) : onChangeText}
      />
      {hint && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{hint}</Txt>}
    </View>
  )
}
