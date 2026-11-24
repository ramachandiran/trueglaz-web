import { useEffect, useState } from 'react'
import { Keyboard, Platform, Pressable, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { dateTime } from '@trueglaz/core'
import { Txt } from './Txt'
import { GearArt } from './kit'
import { useTheme } from '../theme/ThemeContext'

/**
 * The parts every "one thing in detail" screen is built from (TG-139): an order
 * and an item being sold read the same way — a header with a way back, where it
 * stands, how it got there, a summary card, and at most one action pinned to the
 * bottom of the screen.
 */

export function DetailHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={{ paddingTop: insets.top + t.space.x1, paddingHorizontal: t.space.x4, paddingBottom: t.space.x2, flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back"
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="chevron-back" size={21} color={t.colors.text} />
      </Pressable>
      <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{title}</Txt>
    </View>
  )
}

/** The reference line under the header: an order number or SKU, and when. */
export function DetailRef({ code, when }: { code: string; when?: string }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.x2 }}>
      <Txt style={{ color: t.colors.textMuted, fontFamily: t.font.mono, fontSize: t.size.xs }}>{code}</Txt>
      {when ? <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{when}</Txt> : null}
    </View>
  )
}

/** One thing in a summary: the same picture as the list it was opened from, its name, chips and price. */
export interface SummaryThing {
  key: string
  image?: string | null
  title: string
  chips?: { label: string; tone?: 'good' | 'accent' | 'warn' | 'bad' | 'neutral' }[]
  sub?: string
  price?: string
}

export interface SummaryRow { label: string; value: string; tone?: 'good' | 'bad' | 'muted' }

export function SummaryCard({ label, things, rows, total, footer, children }: {
  label: string
  things: SummaryThing[]
  rows?: SummaryRow[]
  total?: { label: string; value: string }
  footer?: string
  children?: React.ReactNode
}) {
  const t = useTheme()
  const chipTone = (tone: NonNullable<SummaryThing['chips']>[number]['tone']) => ({
    good: { fg: t.colors.good, bg: t.colors.goodSoft },
    accent: { fg: t.colors.accentText, bg: t.colors.accentSoft },
    warn: { fg: t.colors.warn, bg: t.colors.warnSoft },
    bad: { fg: t.colors.bad, bg: t.colors.badSoft },
    neutral: { fg: t.colors.textMuted, bg: t.colors.bgSunken },
  }[tone ?? 'neutral'])
  return (
    <View style={{ backgroundColor: t.colors.bgRaised, borderRadius: 16, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: t.space.x4, paddingTop: t.space.x4, paddingBottom: t.space.x2 }}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.6 }}>{label.toUpperCase()}</Txt>
      </View>
      {things.map((x, i) => (
        <View key={x.key} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3, paddingHorizontal: t.space.x4, paddingVertical: t.space.x3,
          borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.colors.border }}>
          <GearArt uri={x.image} width={64} height={64} radius={12} icon={28} lens={/\d+mm\b|f\/\d/i.test(x.title)} />
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Txt numberOfLines={2} style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{x.title}</Txt>
            {(x.chips?.length ?? 0) > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {x.chips!.map((c) => {
                  const k = chipTone(c.tone)
                  return (
                    <View key={c.label} style={{ backgroundColor: k.bg, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8 }}>
                      <Txt style={{ color: k.fg, fontSize: 10.5, fontWeight: t.weight.bold as never }}>{c.label}</Txt>
                    </View>
                  )
                })}
              </View>
            )}
            {x.sub ? <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{x.sub}</Txt> : null}
          </View>
          {x.price ? <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{x.price}</Txt> : null}
        </View>
      ))}
      {(rows?.length || total) && (
        <View style={{ backgroundColor: t.colors.bgSunken, paddingHorizontal: t.space.x4, paddingVertical: t.space.x3, gap: 8 }}>
          {(rows ?? []).map((r) => (
            <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.space.x3 }}>
              <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm, flexShrink: 1 }}>{r.label}</Txt>
              <Txt style={{ color: r.tone === 'good' ? t.colors.good : r.tone === 'bad' ? t.colors.bad : r.tone === 'muted' ? t.colors.textMuted : t.colors.text,
                fontSize: t.size.sm, fontWeight: t.weight.medium as never, textAlign: 'right', flexShrink: 1 }}>{r.value}</Txt>
            </View>
          ))}
          {total && (
            <>
              {(rows?.length ?? 0) > 0 && <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: 2 }} />}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{total.label}</Txt>
                <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never, letterSpacing: -0.4 }}>{total.value}</Txt>
              </View>
            </>
          )}
        </View>
      )}
      {(footer || children) && (
        <View style={{ paddingHorizontal: t.space.x4, paddingVertical: t.space.x3, gap: t.space.x2, borderTopWidth: 1, borderTopColor: t.colors.border }}>
          {footer ? <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{footer}</Txt> : null}
          {children}
        </View>
      )}
    </View>
  )
}

/**
 * The one action that belongs to the whole screen, pinned above the system bar.
 * It steps aside while the keyboard is up (TG-141): a form on the same screen
 * (the ship-it form) needs that height more than a Withdraw button does.
 */
export function StickyFooter({ children }: { children: React.ReactNode }) {
  const t = useTheme()
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const on = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTyping(true))
    const off = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTyping(false))
    return () => { on.remove(); off.remove() }
  }, [])
  if (typing) return null
  return (
    <View style={{ flexDirection: 'row', gap: t.space.x2, paddingHorizontal: t.space.x4, paddingTop: t.space.x3, paddingBottom: t.space.x3,
      backgroundColor: t.colors.bgRaised, borderTopWidth: 1, borderTopColor: t.colors.border }}>
      {children}
    </View>
  )
}

/**
 * The reference people quote to support, made prominent (TG-182, TG-184):
 * the ID large and selectable so it can be copied, when it last changed
 * (highlighted), and when it began. Order details and My item share it.
 */
export function RefCard({ label, code, updatedAt, since }: {
  label: string; code: string; updatedAt: string; since?: { label: string; at: string }
}) {
  const t = useTheme()
  return (
    <View style={{ backgroundColor: t.colors.bgRaised, borderWidth: 1, borderColor: t.colors.border, borderRadius: 16, padding: t.space.x4, gap: t.space.x3 }}>
      <View style={{ gap: 2 }}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.6 }}>{label.toUpperCase()}</Txt>
        <Txt selectable accessibilityLabel={`${label} ${code.split('').join(' ')}`}
          style={{ color: t.colors.text, fontFamily: t.font.mono, fontSize: t.size.xl, fontWeight: t.weight.bold as never, letterSpacing: 0.5 }}>{code}</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.x2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.colors.accentSoft, borderRadius: t.radius.pill, paddingVertical: 6, paddingHorizontal: 12 }}>
          <Ionicons name="time-outline" size={15} color={t.colors.accentText} />
          <Txt style={{ color: t.colors.accentText, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>Last updated {dateTime(updatedAt)}</Txt>
        </View>
        {since && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
            <Ionicons name="calendar-outline" size={14} color={t.colors.textMuted} />
            <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{since.label} {dateTime(since.at)}</Txt>
          </View>
        )}
      </View>
    </View>
  )
}
