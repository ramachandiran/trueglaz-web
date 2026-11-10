/**
 * The app's visual kit (the 2026 redesign): big left-aligned page titles, round
 * icon buttons, pill chips, pill buttons, product cards with a floating action,
 * list rows and section heads. Screens compose these instead of styling inline,
 * so every screen has the same rhythm. Colours come from the theme only, so
 * dark (the default) and light both follow.
 */
import { Image, Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { money, PHOTO_BG, type Theme } from '@trueglaz/core'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'

type IconName = React.ComponentProps<typeof Ionicons>['name']

/** The soft drop shadow cards and round buttons sit on. */
export function lift(t: Theme, strong = false): ViewStyle {
  const dark = t.name === 'dark'
  return {
    shadowColor: '#000',
    shadowOpacity: dark ? (strong ? 0.45 : 0.32) : (strong ? 0.16 : 0.1),
    shadowRadius: strong ? 18 : 14,
    shadowOffset: { width: 0, height: strong ? 10 : 6 },
    elevation: strong ? 8 : 4,
  }
}

/** The big headline every tab screen opens with, and an optional row of round actions above it. */
export function PageTitle({ title, sub, actions, back }: {
  title: string; sub?: string; actions?: React.ReactNode; back?: () => void
}) {
  const t = useTheme()
  return (
    <View style={{ paddingHorizontal: t.space.x4 }}>
      {(back || actions) ? (
        <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {back ? <RoundIcon icon="chevron-back" label="Back" onPress={back} /> : <View />}
          <View style={{ flexDirection: 'row', gap: t.space.x2 }}>{actions}</View>
        </View>
      ) : <View style={{ height: 8 }} />}
      <Txt accessibilityRole="header" style={{ color: t.colors.text, fontSize: 34, fontWeight: t.weight.bold as never, letterSpacing: -0.8, marginTop: 6 }}>
        {title}
      </Txt>
      {sub && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.md, marginTop: 4 }}>{sub}</Txt>}
    </View>
  )
}

export function RoundIcon({ icon, label, onPress, size = 40, tone = 'raised' }: {
  icon: IconName; label: string; onPress?: () => void; size?: number; tone?: 'raised' | 'cta' | 'glass'
}) {
  const t = useTheme()
  const bg = tone === 'cta' ? t.colors.cta : tone === 'glass' ? 'rgba(16,28,36,0.55)' : t.colors.bgRaised
  const fg = tone === 'cta' ? t.colors.onCta : tone === 'glass' ? '#f3f1e4' : t.colors.text
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, tone !== 'glass' && lift(t)]}>
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={fg} />
    </Pressable>
  )
}

export function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress?: () => void; icon?: IconName }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }}
      style={[{ height: 34, paddingHorizontal: 16, borderRadius: t.radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: on ? t.colors.cta : t.colors.bgRaised }, !on && lift(t)]}>
      {icon && <Ionicons name={icon} size={14} color={on ? t.colors.onCta : t.colors.text} />}
      <Txt style={{ fontSize: t.size.sm, color: on ? t.colors.onCta : t.colors.text, fontWeight: (on ? t.weight.bold : t.weight.medium) as never }}>{label}</Txt>
    </Pressable>
  )
}

/** A horizontal row of chips that scrolls past the screen edge. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  const t = useTheme()
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: t.space.x4, gap: t.space.x2, paddingVertical: 6 }}>
      {children}
    </ScrollView>
  )
}

/**
 * The pill button. `primary` is the orange action (navy text, soft orange
 * glow), `ghost` the cream / dark one with the orange outline. `block` fills
 * the width, as at the foot of a product page.
 */
export function Pill({ label, onPress, variant = 'primary', block, small, disabled, icon }: {
  label: string; onPress?: () => void; variant?: 'primary' | 'ghost'; block?: boolean; small?: boolean; disabled?: boolean; icon?: IconName
}) {
  const t = useTheme()
  const primary = variant === 'primary'
  return (
    <Pressable onPress={disabled ? undefined : onPress} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      style={[{
        height: small ? 38 : 52, paddingHorizontal: small ? 20 : 26, borderRadius: t.radius.pill,
        alignSelf: block ? 'stretch' : 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: primary ? t.colors.cta : 'transparent', borderWidth: primary ? 0 : 1.5, borderColor: t.colors.cta,
        opacity: disabled ? 0.5 : 1,
      }, primary && !disabled && { shadowColor: t.colors.cta, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 }]}>
      {icon && <Ionicons name={icon} size={17} color={primary ? t.colors.onCta : t.colors.text} />}
      <Txt style={{
        color: primary ? t.colors.onCta : t.colors.text, fontWeight: t.weight.bold as never,
        fontSize: small ? t.size.sm : t.size.md, letterSpacing: block && primary && !small ? 0.6 : 0,
        textTransform: block && primary && !small ? 'uppercase' : 'none',
      }}>{label}</Txt>
    </Pressable>
  )
}

/** A titled section with an optional subtitle and "View all". */
export function SectionHead({ title, sub, onAll }: { title: string; sub?: string; onAll?: () => void }) {
  const t = useTheme()
  return (
    <View style={{ paddingHorizontal: t.space.x4, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: t.space.x3 }}>
      <View style={{ flex: 1 }}>
        <Txt accessibilityRole="header" style={{ color: t.colors.text, fontSize: 26, fontWeight: t.weight.bold as never, letterSpacing: -0.5 }}>{title}</Txt>
        {sub && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, marginTop: 2 }}>{sub}</Txt>}
      </View>
      {onAll && (
        <Pressable onPress={onAll} hitSlop={8} accessibilityRole="link">
          <Txt style={{ color: t.colors.text, fontSize: t.size.xs, opacity: 0.85 }}>View all</Txt>
        </Pressable>
      )}
    </View>
  )
}

/** The picture of a piece of gear: the photo if there is one, else a drawn tile. */
export function GearArt({ uri, lens, brand, width, height, radius = 12, icon }: {
  uri?: string | null; lens?: boolean; brand?: string | null; width: number | `${number}%`; height: number; radius?: number; icon?: number
}) {
  const t = useTheme()
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: uri ? PHOTO_BG : t.colors.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
      {uri
        ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        : <Ionicons name={lens ? 'aperture-outline' : 'camera-outline'} size={icon ?? 48} color={t.colors.textMuted} />}
      {!uri && brand && (
        <Txt style={{ position: 'absolute', bottom: 10, fontSize: 9, letterSpacing: 1.6, fontWeight: t.weight.bold as never, color: t.colors.textMuted }}>
          {brand.toUpperCase()}
        </Txt>
      )}
    </View>
  )
}

/** A small pill on a photo: the grade (dark) or the saving (orange). */
export function PhotoBadge({ label, tone = 'dark', right }: { label: string; tone?: 'dark' | 'cta'; right?: boolean }) {
  const t = useTheme()
  return (
    <View style={{ position: 'absolute', top: 8, [right ? 'right' : 'left']: 8, height: 22, paddingHorizontal: 9, borderRadius: t.radius.pill,
      justifyContent: 'center', backgroundColor: tone === 'cta' ? t.colors.cta : t.colors.text }}>
      <Txt style={{ fontSize: 11, fontWeight: t.weight.bold as never, color: tone === 'cta' ? t.colors.onCta : t.colors.bg }}>{label}</Txt>
    </View>
  )
}

export type CardGear = {
  title: string; brandName?: string | null; gradeCode: string; priceMinor: number
  msrpMinor?: number | null; savedPct?: number | null; categorySlug?: string | null
}

const isLens = (g: { title: string; categorySlug?: string | null }) =>
  /lens/i.test(g.categorySlug ?? '') || /\d+mm\b|f\/\d/i.test(g.title)

/**
 * A product card in the module view: the picture with the grade and saving on
 * it and a round orange action on its corner, then inspected, brand, name and
 * price (the new price struck through when there is a saving).
 */
export function ProductCard({ g, img, width, height = 176, onPress, onAction, actionIcon = 'bag-handle-outline', actionLabel, style }: {
  g: CardGear; img?: string | null; width: number; height?: number; onPress?: () => void
  /** The round button on the picture; opens the card when not given. */
  onAction?: () => void; actionIcon?: IconName; actionLabel?: string; style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const name = g.title.split('·')[0].trim()
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${name}, ${g.gradeCode}, ${money(g.priceMinor)}`} style={[{ width }, style]}>
      <View>
        <GearArt uri={img} lens={isLens(g)} brand={g.brandName} width={width} height={height} />
        <PhotoBadge label={g.gradeCode} />
        {g.savedPct != null && g.savedPct > 0 && <PhotoBadge label={`-${g.savedPct}%`} tone="cta" right />}
        <View style={{ position: 'absolute', right: -4, bottom: -14 }}>
          <RoundIcon icon={actionIcon} label={actionLabel ?? `Buy ${name}`} onPress={onAction ?? onPress} size={36} tone="cta" />
        </View>
      </View>
      <View style={{ marginTop: 18, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="checkmark-circle" size={12} color={t.colors.good} />
          <Txt style={{ color: t.colors.good, fontSize: 11 }}>Inspected · 25 checks</Txt>
        </View>
        {g.brandName && <Txt style={{ color: t.colors.textMuted, fontSize: 11, marginTop: 2 }}>{g.brandName}</Txt>}
        <Txt numberOfLines={2} style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>{name}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          {g.msrpMinor != null && g.msrpMinor > g.priceMinor && (
            <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, textDecorationLine: 'line-through' }}>{money(g.msrpMinor)}</Txt>
          )}
          <Txt style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{money(g.priceMinor)}</Txt>
        </View>
      </View>
    </Pressable>
  )
}

/** A row in a list of places to go: a bold title, a muted line under it, a chevron. */
export function ListRow({ title, sub, onPress, right, last }: { title: string; sub?: string; onPress?: () => void; right?: React.ReactNode; last?: boolean }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.colors.border, gap: t.space.x3 }}>
      <View style={{ flex: 1 }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.md + 1, fontWeight: t.weight.bold as never }}>{title}</Txt>
        {sub && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, marginTop: 2 }}>{sub}</Txt>}
      </View>
      {right}
      {onPress && <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />}
    </Pressable>
  )
}

/** A raised surface with the kit's radius and shadow, no border. */
export function Surface({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme()
  return <View style={[{ backgroundColor: t.colors.bgRaised, borderRadius: 14 }, lift(t), style]}>{children}</View>
}
