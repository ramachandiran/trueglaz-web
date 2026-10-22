import { View } from 'react-native'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'
import { Badge, Card, Muted } from './ui'
import { StatusTracker, type TrackStep } from './StatusTracker'

export type HeroTone = 'good' | 'warn' | 'bad' | 'accent' | 'neutral'

/**
 * The status hero card from the Start selling flow: a toned border, a status
 * chip, a plain-language headline and a line of explanation — the one way a
 * "where does this stand" summary looks across the app.
 */
export function StatusHero({
  tone, badge, title, body, children,
}: {
  tone: HeroTone
  badge: string
  title: string
  body?: string
  children?: React.ReactNode
}) {
  const t = useTheme()
  const border = {
    good: t.colors.good, warn: t.colors.warn, bad: t.colors.bad,
    accent: t.colors.accent, neutral: t.colors.border,
  }[tone]
  return (
    <Card style={{ borderColor: border, gap: t.space.x2 }}>
      <Badge label={badge} tone={tone} />
      <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{title}</Txt>
      {body ? <Muted>{body}</Muted> : null}
      {children}
    </Card>
  )
}

/**
 * The "YOUR PROGRESS" label + vertical tracker, exactly as the Start selling
 * screen presents a journey. Reused so every journey reads the same.
 */
export function ProgressSection({ steps, label = 'YOUR PROGRESS' }: { steps: TrackStep[]; label?: string }) {
  const t = useTheme()
  return (
    <View style={{ gap: t.space.x2 }}>
      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.6 }}>{label}</Txt>
      <StatusTracker steps={steps} />
    </View>
  )
}
