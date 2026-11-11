import { useEffect, useRef, useState, type ElementRef } from 'react'
import { Animated, Platform, Pressable, TextInput, View } from 'react-native'
import { useReducedMotion } from '../hooks/useReducedMotion'
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
 *
 * `status` paints the result: red and a shake for a wrong code, green for a
 * right one (TG-98). Bump `shakeKey` to shake again on a second wrong try.
 */
export function OtpBoxes({
  value, onChange, onComplete, length = 6, label = 'One-time code', autoFocus = true, error = false,
  status, shakeKey = 0, editable = true, showLabel = true,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  length?: number
  label?: string
  autoFocus?: boolean
  error?: boolean
  status?: 'error' | 'success'
  shakeKey?: number
  editable?: boolean
  showLabel?: boolean
}) {
  const t = useTheme()
  const input = useRef<ElementRef<typeof TextInput>>(null)
  const [focused, setFocused] = useState(autoFocus)
  const digits = value.replace(/\D/g, '').slice(0, length)
  const active = Math.min(digits.length, length - 1)
  const bad = error || status === 'error'
  const good = status === 'success'
  const reduced = useReducedMotion()
  const shake = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!shakeKey || reduced) return
    const native = Platform.OS !== 'web'
    const step = (to: number) => Animated.timing(shake, { toValue: to, duration: 50, useNativeDriver: native })
    Animated.sequence([step(10), step(-10), step(8), step(-8), step(4), step(0)]).start()
  }, [shakeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, length)
    onChange(next)
    if (next.length === length && next !== digits) onComplete?.(next)
  }

  return (
    <View style={{ gap: t.space.x1 }}>
      {showLabel && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{label}</Txt>}
      <Pressable onPress={() => input.current?.focus()} accessible={false}>
        <Animated.View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between', transform: [{ translateX: shake }] }} importantForAccessibility="no-hide-descendants">
          {Array.from({ length }, (_, i) => {
            const on = focused && editable && !good && i === active
            const filled = i < digits.length
            return (
              <View key={i} style={{
                flex: 1, maxWidth: 52, aspectRatio: 0.86, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                borderWidth: on ? 2 : 1.5,
                borderColor: good ? t.colors.good : bad ? t.colors.bad : on ? t.colors.cta : filled ? t.colors.text : t.colors.border,
                backgroundColor: good ? t.colors.goodSoft : bad ? t.colors.badSoft : t.colors.bgRaised,
              }}>
                <Txt style={{ color: good ? t.colors.good : bad ? t.colors.bad : t.colors.text, fontSize: 24, fontFamily: mobileFontFamily.bold }}>
                  {digits[i] ?? ''}
                </Txt>
                {on && !filled && <View style={{ position: 'absolute', bottom: 12, width: 14, height: 2, borderRadius: 1, backgroundColor: t.colors.cta }} />}
              </View>
            )
          })}
        </Animated.View>
        <TextInput
          ref={input}
          value={digits}
          onChangeText={set}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          editable={editable}
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
