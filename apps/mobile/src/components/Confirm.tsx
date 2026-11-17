import { useEffect, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Txt } from './Txt'
import { Button } from './form'
import { useTheme } from '../theme/ThemeContext'

/**
 * The app's own confirm and notice dialogs (TG-140), in place of the system
 * Alert. The system one is a white Android box in the platform's font that
 * ignores the theme; this one is a TrueGlaz card in the current theme, with
 * the destructive choice in red and the safe one first.
 *
 *   if (await confirm({ title: 'Remove this wish?', message: r.wanted, confirmLabel: 'Remove', destructive: true })) …
 *   notify('Could not remove it', e.message)
 *
 * One <DialogHost/> is mounted at the root of the app; the calls work from
 * anywhere, including outside React (an async handler after a failed request).
 */
export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button and a warning icon: deleting, declining, withdrawing. */
  destructive?: boolean
}

interface Pending extends ConfirmOptions { notice?: boolean; resolve: (ok: boolean) => void }

let show: ((p: Pending) => void) | null = null
const queue: Pending[] = []

function open(p: Pending) {
  if (show) show(p)
  else queue.push(p)
}

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => open({ ...opts, resolve }))
}

/** A one-button notice, e.g. why something failed. */
export function notify(title: string, message?: string): Promise<void> {
  return new Promise((resolve) => open({ title, message, notice: true, confirmLabel: 'OK', resolve: () => resolve() }))
}

export function DialogHost() {
  const t = useTheme()
  const [current, setCurrent] = useState<Pending | null>(null)
  const [waiting, setWaiting] = useState<Pending[]>([])

  useEffect(() => {
    show = (p) => setWaiting((w) => [...w, p])
    if (queue.length) setWaiting((w) => [...w, ...queue.splice(0)])
    return () => { show = null }
  }, [])

  // One dialog at a time; the next opens when this one closes.
  useEffect(() => {
    if (!current && waiting.length) { setCurrent(waiting[0]); setWaiting((w) => w.slice(1)) }
  }, [current, waiting])

  const close = (ok: boolean) => { current?.resolve(ok); setCurrent(null) }
  const d = current

  return (
    <Modal visible={!!d} transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
      <Pressable onPress={() => close(false)} accessibilityLabel="Close"
        style={{ flex: 1, backgroundColor: 'rgba(8, 14, 20, 0.55)', alignItems: 'center', justifyContent: 'center', padding: t.space.x5 }}>
        {d && (
          <Pressable onPress={() => {}} accessibilityRole="alert"
            style={{ width: '100%', maxWidth: 380, backgroundColor: t.colors.bgRaised, borderRadius: 18, borderWidth: 1, borderColor: t.colors.border,
              padding: t.space.x5, gap: t.space.x3,
              shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: d.destructive ? t.colors.badSoft : t.colors.accentSoft }}>
              <Ionicons name={d.destructive ? 'alert-circle-outline' : d.notice ? 'information-circle-outline' : 'help-circle-outline'}
                size={24} color={d.destructive ? t.colors.bad : t.colors.accent} />
            </View>
            <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{d.title}</Txt>
            {!!d.message && <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm, lineHeight: 20 }}>{d.message}</Txt>}
            <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
              {!d.notice && <Button label={d.cancelLabel ?? 'Cancel'} variant="ghost" onPress={() => close(false)} style={{ flex: 1 }} />}
              <Button label={d.confirmLabel ?? 'OK'} variant={d.destructive ? 'danger' : 'cta'} onPress={() => close(true)}
                style={{ flex: 1, ...(d.destructive ? { backgroundColor: t.colors.bad } : {}) }} />
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  )
}
