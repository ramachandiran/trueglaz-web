import { useState } from 'react'
import { ScrollView, Switch, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { api, ApiError, useApi, type NotificationSettings } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { Pill, Surface } from '../components/kit'
import { ErrorNote, Loading, Muted } from '../components/ui'
import { useTheme } from '../theme/ThemeContext'
import { disablePush, enablePush, openSystemSettings, usePushState } from '../push'

/**
 * What a person hears about, and where: this phone's push on/off, then each
 * kind of message per channel. In-app is always kept; security is always on.
 */
export function NotificationSettingsScreen() {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const settings = useApi(() => api.notificationSettings(), [])
  const [view, setView] = useState<NotificationSettings | null>(null)
  const [push, refreshPush] = usePushState()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const s = view ?? settings.data

  async function toggle(category: string, channel: string, enabled: boolean) {
    setErr(null)
    try { setView(await api.updateNotificationSettings([{ category, channel, enabled }])) }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not save that') }
  }

  const pushChannelOn = !!s?.channels.some((c) => c.code === 'push')

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: insets.bottom + t.space.x6 }}>
      {pushChannelOn && (
        <Surface style={{ padding: t.space.x4, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="phone-portrait-outline" size={22} color={t.colors.accent} />
            <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never, flex: 1 }}>Push on this phone</Txt>
            {push === 'granted' && <Txt style={{ color: t.colors.good, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>On</Txt>}
          </View>
          {push === 'unsupported' && <Muted size={t.size.sm}>This build of the app cannot receive pushes yet.</Muted>}
          {push === 'undetermined' && (
            <>
              <Muted size={t.size.sm}>Order updates, payouts and quotes as they happen. Nothing between 10 pm and 8 am unless it's a security alert.</Muted>
              <Pill label={busy ? 'Turning on…' : 'Turn on'} block disabled={busy} onPress={async () => { setBusy(true); await enablePush(true); setBusy(false); refreshPush() }} />
            </>
          )}
          {push === 'denied' && (
            <>
              <Muted size={t.size.sm}>Notifications are blocked for TrueGlaz on this phone. Allow them in the phone's settings.</Muted>
              <Pill label="Open phone settings" block variant="ghost" onPress={openSystemSettings} />
            </>
          )}
          {push === 'granted' && (
            <Pill label="Stop pushes on this phone" small variant="ghost" onPress={async () => { await disablePush(); refreshPush() }} />
          )}
        </Surface>
      )}

      {settings.loading && !s && <Loading />}
      {settings.error && <ErrorNote error={settings.error} onRetry={settings.reload} />}
      {s && s.channels.length === 0 && (
        <Muted size={t.size.sm}>You get every update in the app's Notifications. Email, WhatsApp and push aren't switched on yet.</Muted>
      )}
      {s && s.channels.length > 0 && (
        <View style={{ gap: t.space.x3 }}>
          <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never }}>What you hear about</Txt>
          <Muted size={t.size.xs}>Everything always shows in the app's Notifications too.</Muted>
          {s.categories.map((c) => (
            <Surface key={c.code} style={{ padding: t.space.x4, gap: 8 }}>
              <Txt style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{c.label}</Txt>
              <Muted size={t.size.xs}>{c.hint}</Muted>
              {s.channels.map((ch) => (
                <View key={ch.code} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
                  <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>{ch.label}</Txt>
                  <Switch
                    value={s.enabled[c.code]?.[ch.code] !== false}
                    disabled={c.locked}
                    onValueChange={(v) => toggle(c.code, ch.code, v)}
                    trackColor={{ true: t.colors.cta, false: t.colors.bgSunken }}
                    thumbColor="#ffffff"
                    accessibilityLabel={`${c.label} by ${ch.label}`}
                  />
                </View>
              ))}
            </Surface>
          ))}
          {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
        </View>
      )}
    </ScrollView>
  )
}
