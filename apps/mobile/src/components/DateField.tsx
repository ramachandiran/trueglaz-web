import { useState } from 'react'
import { Platform, Pressable, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Txt } from './Txt'
import { useTheme } from '../theme/ThemeContext'
import { fromIsoDay, prettyDay, toIsoDay, type DateFieldProps } from './dateField.shared'

/**
 * A date, picked from a calendar rather than typed as YYYY-MM-DD (TG-175).
 *
 * The value in and out is the API's `YYYY-MM-DD` (or '' when unset), so the
 * screens using it did not change shape. Android opens the system calendar
 * dialog. iOS opens Apple's calendar inline under the field instead of in a
 * pop-up: every date field in the app already sits in a bottom sheet, and a
 * modal on top of a modal is where iOS goes wrong.
 */
export function DateField({ label, value, onChange, minimumDate, maximumDate, placeholder = 'Choose a date', hint, optional }: DateFieldProps) {
  const t = useTheme()
  const [open, setOpen] = useState(false)
  const current = fromIsoDay(value)
  const min = fromIsoDay(minimumDate)
  const max = fromIsoDay(maximumDate)
  // Opening on an empty field starts at today, kept inside the allowed range.
  const start = current ?? clamp(new Date(), min, max)

  const press = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: start, mode: 'date', minimumDate: min ?? undefined, maximumDate: max ?? undefined,
        onChange: (e, d) => { if (e.type === 'set' && d) onChange(toIsoDay(d)) },
      })
    } else {
      // The first tap on an empty field picks the starting day, so Done is never a no-op.
      if (!open && !current) onChange(toIsoDay(start))
      setOpen((o) => !o)
    }
  }

  const shown = current ? prettyDay(current) : null
  return (
    <View style={{ gap: t.space.x1 }}>
      {label && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs, fontWeight: t.weight.medium as never }}>{label}</Txt>}
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: open ? t.colors.accent : t.colors.borderInput,
        borderRadius: t.radius.md, backgroundColor: t.colors.bgRaised }}>
        <Pressable onPress={press} accessibilityRole="button"
          accessibilityLabel={`${label ?? 'Date'}: ${shown ?? 'not set'}`} accessibilityHint="Opens a calendar"
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space.x2, paddingHorizontal: t.space.x3, paddingVertical: t.space.x3 }}>
          <Ionicons name="calendar-outline" size={18} color={t.colors.accent} />
          <Txt style={{ flex: 1, color: shown ? t.colors.text : t.colors.textMuted, fontSize: t.size.md }}>{shown ?? placeholder}</Txt>
          {Platform.OS === 'ios' && <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={t.colors.textMuted} />}
        </Pressable>
        {optional && current && (
          <Pressable onPress={() => { onChange(''); setOpen(false) }} accessibilityRole="button" accessibilityLabel={`Clear ${label ?? 'date'}`}
            hitSlop={8} style={{ paddingHorizontal: t.space.x3, paddingVertical: t.space.x3 }}>
            <Ionicons name="close-circle" size={18} color={t.colors.textMuted} />
          </Pressable>
        )}
      </View>
      {open && Platform.OS === 'ios' && (
        <View style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, backgroundColor: t.colors.bgRaised, overflow: 'hidden' }}>
          <DateTimePicker value={current ?? start} mode="date" display="inline"
            minimumDate={min ?? undefined} maximumDate={max ?? undefined}
            themeVariant={t.name === 'light' ? 'light' : 'dark'} accentColor={t.colors.accent}
            onChange={(_, d) => { if (d) onChange(toIsoDay(d)) }} />
          <Pressable onPress={() => setOpen(false)} accessibilityRole="button"
            style={{ alignSelf: 'flex-end', paddingHorizontal: t.space.x4, paddingVertical: t.space.x3 }}>
            <Txt style={{ color: t.colors.accentText, fontWeight: t.weight.bold as never }}>Done</Txt>
          </Pressable>
        </View>
      )}
      {hint && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{hint}</Txt>}
    </View>
  )
}

function clamp(d: Date, min: Date | null, max: Date | null): Date {
  if (min && d < min) return min
  if (max && d > max) return max
  return d
}
