import { View, StyleSheet } from 'react-native'
import { relative, STATE_BLURBS, type TimelineStep } from '@trueglaz/core'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'

/**
 * The lifecycle as one line, rendered with native primitives.
 *
 * Every step, its status and the decision to stop projecting past a terminal
 * state come from `buildTimeline` in @trueglaz/core — the same function the web
 * app calls. Only the drawing differs.
 *
 * Vertical by default: on a phone a 14-stage horizontal line is unreadable, and
 * the web app already stacks it below 720px for the same reason.
 */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  const t = useTheme()
  if (!steps.length) return null

  return (
    <View accessibilityRole="list">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1
        const nodeColor =
          step.status === 'upcoming'
            ? 'transparent'
            : step.detour
              ? t.colors.stepDetour
              : step.status === 'current'
                ? t.colors.stepCurrent
                : t.colors.stepDone
        const borderColor =
          step.status === 'upcoming'
            ? t.colors.stepUpcoming
            : step.detour
              ? t.colors.stepDetour
              : step.status === 'current'
                ? t.colors.stepCurrent
                : t.colors.stepDone
        const connector = step.status === 'done' ? t.colors.stepDone : t.colors.stepUpcoming

        return (
          <View
            key={step.state}
            style={styles.row}
            accessibilityRole="text"
            accessibilityLabel={
              `${step.label}. ` +
              (step.status === 'done' ? 'Completed' : step.status === 'current' ? 'Current state' : 'Upcoming') +
              `. ${STATE_BLURBS[step.state] ?? ''}`
            }
          >
            <View style={styles.rail}>
              <View
                style={[
                  styles.node,
                  { backgroundColor: nodeColor, borderColor },
                  step.status === 'current' && {
                    shadowColor: t.colors.stepCurrent,
                    shadowOpacity: 0.4,
                    shadowRadius: 6,
                    elevation: 4,
                  },
                ]}
              >
                {step.status === 'done' && (
                  <Txt style={[styles.glyph, { color: t.colors.onAccent }]}>✓</Txt>
                )}
                {step.status === 'current' && (
                  <View style={[styles.dot, { backgroundColor: t.colors.onAccent }]} />
                )}
              </View>
              {!isLast && <View style={[styles.connector, { backgroundColor: connector }]} />}
            </View>

            <View style={styles.body}>
              <Txt
                style={[
                  styles.label,
                  {
                    color: step.status === 'upcoming' ? t.colors.textMuted : t.colors.text,
                    fontWeight: step.status === 'upcoming' ? t.weight.normal : t.weight.medium,
                    fontSize: t.size.sm,
                  } as never,
                ]}
              >
                {step.label}
              </Txt>
              <Txt style={[styles.meta, { color: t.colors.textMuted, fontSize: t.size.xs }]}>
                {step.status === 'upcoming'
                  ? 'Not yet'
                  : `${relative(step.occurredAt)}${step.actorRole ? ` · by ${step.actorRole}` : ''}`}
              </Txt>
              {step.reasonCode && (
                <Txt
                  style={[
                    styles.reason,
                    { color: t.colors.stepDetour, fontSize: t.size.xs, fontFamily: t.font.mono },
                  ]}
                >
                  {step.reasonCode}
                </Txt>
              )}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const NODE = 24

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: NODE },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 12, fontWeight: '700', lineHeight: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connector: { width: 2, flex: 1, minHeight: 20 },
  body: { flex: 1, paddingBottom: 20 },
  label: { marginBottom: 1 },
  meta: {},
  reason: { marginTop: 2 },
})
