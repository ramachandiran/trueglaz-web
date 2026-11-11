import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'

/**
 * How long a one-time code has left, and a way to ask for another once the
 * server's cooldown has passed — before expiry too, for an email that never came (TG-97).
 *
 * Counts to a deadline worked out when the code arrived (now + the server's
 * `expiresInSeconds`) rather than ticking a counter down, so it stays right
 * after the app has been in the background and does not trust the phone's
 * clock to agree with the server's.
 */
export function CodeTimer({
  deadline, resendAt = deadline, onResend, resending = false, onExpire, align = 'center',
}: {
  /** `Date.now()` at which the code stops working. */
  deadline: number
  /** `Date.now()` from which another code may be asked for (the server's cooldown). */
  resendAt?: number
  onResend: () => void
  resending?: boolean
  onExpire?: () => void
  align?: 'center' | 'flex-start'
}) {
  const t = useTheme()
  const left = useSecondsUntil(deadline)
  const canResend = useSecondsUntil(resendAt) === 0
  useEffect(() => { if (left === 0) onExpire?.() }, [left === 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const resendLink = (
    <Pressable onPress={resending ? undefined : onResend} accessibilityRole="button" hitSlop={10}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {resending && <ActivityIndicator size="small" color={t.colors.accent} />}
      <Txt style={{ color: t.colors.accent, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>
        {resending ? 'Sending…' : 'Resend code'}
      </Txt>
    </Pressable>
  )

  if (left > 0) {
    const m = Math.floor(left / 60)
    const s = String(left % 60).padStart(2, '0')
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: align, gap: t.space.x3, flexWrap: 'wrap' }}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm }} accessibilityLiveRegion={left <= 10 ? 'polite' : 'none'}>
          Code expires in <Txt style={{ color: left <= 10 ? t.colors.bad : t.colors.text, fontWeight: t.weight.bold as never }}>{m}:{s}</Txt>
        </Txt>
        {canResend && resendLink}
      </View>
    )
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: align, gap: t.space.x2, flexWrap: 'wrap' }}>
      <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }} accessibilityLiveRegion="polite">Code expired.</Txt>
      {resendLink}
    </View>
  )
}

export function useSecondsUntil(deadline: number) {
  const calc = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
  const [left, setLeft] = useState(calc)
  useEffect(() => {
    setLeft(calc())
    const id = setInterval(() => setLeft(calc()), 500)
    return () => clearInterval(id)
  }, [deadline]) // eslint-disable-line react-hooks/exhaustive-deps
  return left
}
