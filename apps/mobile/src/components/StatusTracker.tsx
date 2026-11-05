import { View } from 'react-native'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'

export type TrackState = 'done' | 'current' | 'upcoming' | 'cancelled'
export interface TrackStep {
  title: string
  desc?: string
  state: TrackState
  /** Optional status chip under the step (e.g. "In progress", "Delivered"). */
  meta?: string
  tone?: 'ok' | 'now' | 'next' | 'bad'
}

/**
 * A vertical status tracker: numbered nodes joined by a rail, the current step
 * highlighted. Shared by the seller onboarding and the buyer order views so a
 * "where is this" readout looks the same everywhere.
 */
export function StatusTracker({ steps }: { steps: TrackStep[] }) {
  return (
    <View>
      {steps.map((s, i) => (
        <Row key={s.title} index={i + 1} step={s} last={i === steps.length - 1} />
      ))}
    </View>
  )
}

function Row({ index, step, last }: { index: number; step: TrackStep; last: boolean }) {
  const t = useTheme()
  const { state } = step
  const done = state === 'done'
  const current = state === 'current'
  const cancelled = state === 'cancelled'

  const node = done
    ? { bg: t.colors.good, border: t.colors.good, fg: '#ffffff' }
    : current
      ? { bg: t.colors.accent, border: t.colors.accent, fg: '#ffffff' }
      : cancelled
        ? { bg: t.colors.bad, border: t.colors.bad, fg: '#ffffff' }
        : { bg: t.colors.bgRaised, border: t.colors.border, fg: t.colors.textMuted }

  const tone = step.tone ?? (done ? 'ok' : current ? 'now' : cancelled ? 'bad' : 'next')
  const meta = tone === 'ok'
    ? { bg: t.colors.goodSoft, fg: t.colors.good }
    : tone === 'now'
      ? { bg: t.colors.accentSoft, fg: t.colors.accent }
      : tone === 'bad'
        ? { bg: t.colors.badSoft, fg: t.colors.bad }
        : { bg: t.colors.bgSunken, fg: t.colors.textMuted }

  const glyph = done ? '✓' : cancelled ? '✕' : String(index)

  return (
    <View style={{ flexDirection: 'row', gap: t.space.x3 }}>
      <View style={{ alignItems: 'center', width: 32 }}>
        <View style={[
          { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: node.bg, borderColor: node.border },
          current && { shadowColor: t.colors.accent, shadowOpacity: 0.35, shadowRadius: 5, elevation: 3 },
        ]}>
          <Txt style={{ color: node.fg, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{glyph}</Txt>
        </View>
        {!last && <View style={{ width: 2, flex: 1, minHeight: 22, marginVertical: 3, backgroundColor: done ? t.colors.good : t.colors.border }} />}
      </View>

      <View style={{ flex: 1, paddingBottom: last ? 4 : t.space.x4 }}>
        <Txt style={{ color: state === 'upcoming' ? t.colors.textMuted : t.colors.text, fontWeight: (state === 'upcoming' ? t.weight.medium : t.weight.bold) as never, fontSize: t.size.md }}>
          {step.title}
        </Txt>
        {step.desc ? <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{step.desc}</Txt> : null}
        {step.meta ? (
          <View style={{ alignSelf: 'flex-start', marginTop: 6, backgroundColor: meta.bg, borderRadius: t.radius.pill, paddingHorizontal: t.space.x3, paddingVertical: 3 }}>
            <Txt style={{ color: meta.fg, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{step.meta}</Txt>
          </View>
        ) : null}
      </View>
    </View>
  )
}
