import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/ThemeContext'

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'accent'

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = useTheme()
  const map: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: t.colors.bgSunken, fg: t.colors.textMuted },
    good: { bg: t.colors.goodSoft, fg: t.colors.good },
    warn: { bg: t.colors.warnSoft, fg: t.colors.warn },
    bad: { bg: t.colors.badSoft, fg: t.colors.bad },
    accent: { bg: t.colors.accentSoft, fg: t.colors.accent },
  }
  const c = map[tone]
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderRadius: t.radius.pill }]}>
      <Text style={{ color: c.fg, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>
        {label}
      </Text>
    </View>
  )
}

export function StateBadge({ state }: { state: string }) {
  const bad = ['REJECTED_PRE_INTAKE', 'INSPECTION_FAILED', 'QUARANTINED', 'SELLER_DECLINED', 'RETURNED']
  const warn = ['RETURN_REQUESTED', 'RETURN_TO_SELLER', 'UNSOLD_REVIEW', 'AWAITING_SELLER_APPROVAL']
  const good = ['ACCEPTED', 'LISTED', 'DELIVERED']
  const tone: Tone = bad.includes(state) ? 'bad' : warn.includes(state) ? 'warn' : good.includes(state) ? 'good' : 'neutral'
  return <Badge label={state.replace(/_/g, ' ')} tone={tone} />
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const t = useTheme()
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.bgRaised,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radius.lg,
          padding: t.space.x4,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const t = useTheme()
  return (
    <Text
      style={{
        color: t.colors.text,
        fontSize: t.size.lg,
        fontWeight: t.weight.bold as never,
        marginBottom: t.space.x2,
      }}
    >
      {children}
    </Text>
  )
}

export function Muted({ children, size }: { children: React.ReactNode; size?: number }) {
  const t = useTheme()
  return <Text style={{ color: t.colors.textMuted, fontSize: size ?? t.size.sm }}>{children}</Text>
}

export function Loading() {
  const t = useTheme()
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={t.colors.accent} />
    </View>
  )
}

export function ErrorNote({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const t = useTheme()
  return (
    <Card style={{ borderColor: t.colors.bad, gap: t.space.x2 }}>
      <Text style={{ color: t.colors.bad, fontWeight: t.weight.bold as never }}>
        Something went wrong
      </Text>
      <Muted>{error.message}</Muted>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={{
            alignSelf: 'flex-start',
            paddingVertical: t.space.x2,
            paddingHorizontal: t.space.x3,
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: t.radius.md,
          }}
        >
          <Text style={{ color: t.colors.text }}>Try again</Text>
        </Pressable>
      )}
    </Card>
  )
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  const t = useTheme()
  return (
    <Card style={{ alignItems: 'center', paddingVertical: t.space.x6 }}>
      <Text style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{title}</Text>
      {hint && <View style={{ marginTop: t.space.x2 }}><Muted>{hint}</Muted></View>}
    </Card>
  )
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  centre: { paddingVertical: 32, alignItems: 'center' },
})
