import { useState } from 'react'
import { View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Txt } from './Txt'
import { Pill } from './kit'
import { useTheme } from '../theme/ThemeContext'
import { enablePush, usePushState } from '../push'

/**
 * A soft ask for notifications, shown at a moment that explains itself (after an
 * order, after asking for a quote). Only when the system prompt has not been
 * answered yet; it disappears once the person decides either way.
 */
export function PushPrompt({ reason }: { reason: string }) {
  const t = useTheme()
  const [state, refresh] = usePushState()
  const [hidden, setHidden] = useState(false)
  if (hidden || state !== 'undetermined') return null
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: t.colors.bgRaised, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: t.colors.border }}>
      <Ionicons name="notifications-outline" size={24} color={t.colors.accent} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>Get updates on this phone</Txt>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.xs }}>{reason}</Txt>
      </View>
      <Pill label="Turn on" small onPress={async () => { await enablePush(true); refresh(); setHidden(true) }} />
    </View>
  )
}
