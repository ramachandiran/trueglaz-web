import { useRef, useState, type ElementRef } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'
import { mobileFontFamily } from '../theme/fonts'

/**
 * A one-time code as six boxes that fill as you type (TG-95).
 *
 * One real input sits invisibly over the boxes, so the keyboard, paste and the
 * phone's own "from Messages / from Mail" suggestion all work exactly as with a
 * plain field, and a screen reader hears one "One-time code" input rather than
 * six. When the last digit lands, [onComplete] fires so the screen can carry on
 * without another tap.
 */
export function OtpBoxes({
  value, onChange, onComplete, length = 6, label = 'One-time code', autoFocus = true, error = false,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  length?: number
  label?: string
  autoFocus?: boolean
  error?: boolean
}) {
  const t = useTheme()
  const input = useRef<ElementRef<typeof TextInput>>(null)
  const [focused, setFocused] = useState(autoFocus)
  const digits = value.replace(/\D/g, '').slice(0, length)
  const active = Math.min(digits.length, length - 1)

  const set = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, length)
    onChange(next)
    if (next.length === length && next !== digits) onComplete?.(next)
  }

  return (
    <View style={{ gap: t.space.x1 }}>
      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{label}</Txt>
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }} importantForAccessibility="no-hide-descendants">
          {Array.from({ length }, (_, i) => {
            const on = focused && i === active
            const filled = i < digits.length
            return (
              <View key={i} style={{
                flex: 1, maxWidth: 52, aspectRatio: 0.86, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                borderWidth: on ? 2 : 1.5,
                borderColor: error ? t.colors.bad : on ? t.colors.cta : filled ? t.colors.text : t.colors.border,
                backgroundColor: t.colors.bgRaised,
              }}>
                <Txt style={{ color: t.colors.text, fontSize: 24, fontFamily: mobileFontFamily.bold }}>
                  {digits[i] ?? ''}
                </Txt>
                {on && !filled && <View style={{ position: 'absolute', bottom: 12, width: 14, height: 2, borderRadius: 1, backgroundColor: t.colors.cta }} />}
              </View>
            )
          })}
        </View>
        <TextInput
          ref={input}
          value={digits}
          onChangeText={set}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          caretHidden
          // Invisible but still the real field: it receives taps, typing, paste and autofill.
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent', backgroundColor: 'transparent', borderWidth: 0, fontSize: 1 }}
        />
      </Pressable>
    </View>
  )
}
