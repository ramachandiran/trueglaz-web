import { useMemo, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Txt, MAX_FONT_SCALE } from './Txt'
import { BottomSheet } from './BottomSheet'
import { useTheme } from '../theme/ThemeContext'
import { mobileFontFamily } from '../theme/fonts'

export interface SelectOption { value: string; label: string; hint?: string }

/**
 * A drop-down (TG-186): looks like a text field, opens a list in a sheet. Long
 * lists get a search box at the top, so "Sony" is two letters away rather
 * than a scroll through every brand.
 */
export function SelectField({ label, placeholder = 'Choose…', value, options, onChange, title, searchAbove = 8 }: {
  label?: string
  placeholder?: string
  value: string | null
  options: SelectOption[]
  onChange: (value: string) => void
  /** The sheet's heading; defaults to the label. */
  title?: string
  /** Show a search box when there are more options than this. */
  searchAbove?: number
}) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const chosen = options.find((o) => o.value === value) ?? null
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase()
    return k ? options.filter((o) => o.label.toLowerCase().includes(k)) : options
  }, [options, q])

  return (
    <View style={{ gap: t.space.x1 }}>
      {label && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{label}</Txt>}
      <Pressable onPress={() => { setQ(''); setOpen(true) }} accessibilityRole="button"
        accessibilityLabel={`${label ?? title ?? 'Choose'}: ${chosen?.label ?? 'not chosen'}`} accessibilityHint="Opens a list"
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, borderWidth: 1, borderColor: t.colors.borderInput,
          borderRadius: t.radius.md, backgroundColor: t.colors.bgRaised, paddingHorizontal: t.space.x3, paddingVertical: t.space.x3 }}>
        <Txt style={{ flex: 1, color: chosen ? t.colors.text : t.colors.textMuted, fontSize: t.size.md }}>{chosen?.label ?? placeholder}</Txt>
        <Ionicons name="chevron-down" size={18} color={t.colors.textMuted} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} scroll maxHeight="80%"
        header={(
          <View style={{ gap: t.space.x3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt accessibilityRole="header" style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{title ?? label ?? 'Choose'}</Txt>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
                <Ionicons name="close" size={22} color={t.colors.textMuted} />
              </Pressable>
            </View>
            {options.length > searchAbove && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x2, borderWidth: 1, borderColor: t.colors.borderInput,
                borderRadius: t.radius.pill, paddingHorizontal: t.space.x3, backgroundColor: t.colors.bg }}>
                <Ionicons name="search" size={16} color={t.colors.textMuted} />
                <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={t.colors.textMuted}
                  accessibilityLabel={`Search ${(title ?? label ?? '').toLowerCase()}`} autoCorrect={false} maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={{ flex: 1, minHeight: 42, color: t.colors.text, fontFamily: mobileFontFamily.regular, fontSize: t.size.md }} />
              </View>
            )}
          </View>
        )}>
        {shown.length === 0 && <Txt style={{ color: t.colors.textMuted, paddingVertical: t.space.x3 }}>Nothing matches “{q.trim()}”.</Txt>}
        {shown.map((o, i) => {
          const on = o.value === value
          return (
            <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }}
              onPress={() => { onChange(o.value); setOpen(false) }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: t.space.x3, minHeight: 52, paddingVertical: t.space.x2,
                borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.colors.border, backgroundColor: pressed ? t.colors.bgHover : 'transparent' })}>
              <View style={{ flex: 1 }}>
                <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: (on ? t.weight.bold : t.weight.normal) as never }}>{o.label}</Txt>
                {o.hint ? <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{o.hint}</Txt> : null}
              </View>
              {on && <Ionicons name="checkmark-circle" size={22} color={t.colors.accent} />}
            </Pressable>
          )
        })}
      </BottomSheet>
    </View>
  )
}
