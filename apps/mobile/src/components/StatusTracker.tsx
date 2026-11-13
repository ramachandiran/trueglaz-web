import { Animated, View } from 'react-native'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'
import { FadeIn, Pop, PulseRing, useFill } from './motion'

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
export function StatusTracker({ steps, animateFrom = 0, stepMs = 90 }: {
  steps: TrackStep[]
  /**
   * Motion (TG-120): rows before this index are drawn as they are; from here
   * on each row arrives in turn, its node popping in and the rail below it
   * filling. An order that moved since it was last opened passes the step it
   * was on, so the buyer watches it travel to where it is now.
   */
  animateFrom?: number
  /** Gap between rows arriving: brisk on a first look, slower when replaying a change. */
  stepMs?: number
}) {
  return (
    <View>
      {steps.map((s, i) => (
        <Row key={s.title} index={i + 1} step={s} last={i === steps.length - 1}
          still={i < animateFrom} delay={Math.max(0, i - animateFrom) * stepMs} />
      ))}
    </View>
  )
}

function Row({ index, step, last, still, delay }: { index: number; step: TrackStep; last: boolean; still: boolean; delay: number }) {
  const t = useTheme()
  const { state } = step
  const done = state === 'done'
  const current = state === 'current'
  const cancelled = state === 'cancelled'

  const node = done
    ? { bg: t.colors.good, border: t.colors.good, fg: '#ffffff' }
    : current
      ? { bg: t.colors.accent, border: t.colors.accent, fg: t.colors.onAccent }
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
  const nodeView = (
    <View style={[
      { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: node.bg, borderColor: node.border },
      current && { shadowColor: t.colors.accent, shadowOpacity: 0.35, shadowRadius: 5, elevation: 3 },
    ]}>
      <Txt style={{ color: node.fg, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{glyph}</Txt>
    </View>
  )
  const Body = still ? View : FadeIn

  return (
    <View style={{ flexDirection: 'row', gap: t.space.x3 }}>
      <View style={{ alignItems: 'center', width: 32 }}>
        <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
          {current && <PulseRing size={30} color={t.colors.accent} delay={still ? 0 : delay + 350} />}
          {still ? nodeView : <Pop delay={delay}>{nodeView}</Pop>}
        </View>
        {!last && (
          <View style={{ width: 2, flex: 1, minHeight: 22, marginVertical: 3, backgroundColor: t.colors.border, overflow: 'hidden' }}>
            {done && (still
              ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.good }} />
              : <Rail color={t.colors.good} delay={delay + 120} />)}
          </View>
        )}
      </View>

      <Body {...(still ? {} : { delay, from: 6 })} style={{ flex: 1, paddingBottom: last ? 4 : t.space.x4 }}>
        <Txt style={{ color: state === 'upcoming' ? t.colors.textMuted : t.colors.text, fontWeight: (state === 'upcoming' ? t.weight.medium : t.weight.bold) as never, fontSize: t.size.md }}>
          {step.title}
        </Txt>
        {step.desc ? <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{step.desc}</Txt> : null}
        {step.meta ? (
          <View style={{ alignSelf: 'flex-start', marginTop: 6, backgroundColor: meta.bg, borderRadius: t.radius.pill, paddingHorizontal: t.space.x3, paddingVertical: 3 }}>
            <Txt style={{ color: meta.fg, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{step.meta}</Txt>
          </View>
        ) : null}
      </Body>
    </View>
  )
}

/** The rail under a finished step, drawn top to bottom. */
function Rail({ color, delay }: { color: string; delay: number }) {
  const fill = useFill(delay, 260)
  return (
    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: color, height: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
  )
}
