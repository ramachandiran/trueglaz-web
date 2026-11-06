import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  api, getStorage, isOps, money, useSession,
  type ProductModel, type VaultItem,
} from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Muted } from '../components/ui'

const SEEN_KEY = 'trueglaz.vault.introSeen'

/**
 * A one-time, value-led invitation to start a Gear Vault, shown over the Home
 * tab for a brand-new user whose vault is still empty. It leads with the payoff,
 * asks for one field, and shows an instant estimate — never a gate: "Not now"
 * dismisses it and the Vault stays a tab away.
 */
/** `onClosed` lets the Vault screen reload, so gear added here shows at once. */
export function VaultIntro({ onClosed }: { onClosed?: () => void } = {}) {
  const t = useTheme()
  const { session } = useSession()
  const navigation = useNavigation<any>()
  const [eligible, setEligible] = useState(false)
  const [step, setStep] = useState<'offer' | 'added'>('offer')
  const [added, setAdded] = useState<VaultItem | null>(null)

  useEffect(() => {
    let live = true
    ;(async () => {
      if (!session || isOps(session)) return
      try {
        if (await getStorage().get(SEEN_KEY)) return
        const items = await api.vault()
        if (!live) return
        if (items.length > 0) { await getStorage().set(SEEN_KEY, '1'); return }
        setEligible(true)
      } catch { /* vault unreachable — just don't offer */ }
    })()
    return () => { live = false }
  }, [session])

  async function dismiss() {
    setEligible(false)
    try { await getStorage().set(SEEN_KEY, '1') } catch { /* fine */ }
    onClosed?.()
  }

  if (!eligible) return null

  return (
    <Modal transparent animationType="slide" visible onRequestClose={dismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,30,40,0.45)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: t.colors.bg, borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg,
          padding: t.space.x4, maxHeight: '90%',
        }}>
          <ScrollView contentContainerStyle={{ gap: t.space.x3 }} keyboardShouldPersistTaps="handled">
            {step === 'offer'
              ? <Offer onAdded={(it) => { setAdded(it); setStep('added') }} onSkip={dismiss} />
              : <Added item={added!} onAddAnother={() => { setAdded(null); setStep('offer') }}
                  onOpen={() => { dismiss(); navigation.navigate('Vault') }} onDone={dismiss} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function Offer({ onAdded, onSkip }: { onAdded: (it: VaultItem) => void; onSkip: () => void }) {
  const t = useTheme()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ProductModel[]>([])
  const [model, setModel] = useState<ProductModel | null>(null)
  const [busy, setBusy] = useState(false)

  async function search(text: string) {
    setQ(text); setModel(null)
    if (text.trim().length < 2) { setResults([]); return }
    try { setResults((await api.searchModels(text.trim(), 6)).content) } catch { setResults([]) }
  }

  async function add() {
    setBusy(true)
    try {
      const it = await api.addGear({ productModelId: model?.id ?? null, modelFreeText: model ? null : q.trim() || null })
      onAdded(it)
    } finally { setBusy(false) }
  }

  return (
    <>
      <Txt style={{ color: t.colors.accent, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.7 }}>GEAR VAULT</Txt>
      <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>See what your gear is worth</Txt>
      <Muted size={t.size.sm}>
        Add a camera or lens you own and we’ll value it from real TrueGlaz sales — then track its warranty and insure it. No selling required.
      </Muted>
      <Field label="Start with one item" placeholder="e.g. Sony A7 III" value={model ? model.name : q} onChangeText={search} autoFocus />
      {!model && results.length > 0 && (
        <View style={{ borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, overflow: 'hidden' }}>
          {results.map((m) => (
            <Pressable key={m.id} onPress={() => { setModel(m); setResults([]) }}
              style={{ paddingVertical: t.space.x3, paddingHorizontal: t.space.x3, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
              <Txt style={{ color: t.colors.text, fontSize: t.size.sm }}>{m.name}</Txt>
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
        <Button label="Not now" variant="ghost" onPress={onSkip} style={{ flex: 1 }} />
        <Button label={busy ? 'Valuing…' : 'See its value'} onPress={add} loading={busy}
          disabled={busy || (!model && q.trim().length < 2)} style={{ flex: 1 }} />
      </View>
    </>
  )
}

function Added({ item, onAddAnother, onOpen, onDone }: {
  item: VaultItem; onAddAnother: () => void; onOpen: () => void; onDone: () => void
}) {
  const t = useTheme()
  const v = item.valuation
  return (
    <>
      <Txt style={{ color: t.colors.accent, fontSize: t.size.xs, fontWeight: t.weight.bold as never, letterSpacing: 0.7 }}>IN YOUR VAULT</Txt>
      <Txt style={{ color: t.colors.text, fontSize: t.size.xl, fontWeight: t.weight.bold as never }}>{item.modelLabel}</Txt>
      {v ? (
        <View style={{ backgroundColor: t.colors.brand, borderRadius: t.radius.md, padding: t.space.x4, gap: 3 }}>
          <Txt style={{ color: t.colors.onBrand, fontSize: t.size.xxl, fontWeight: t.weight.bold as never }}>~{money(v.midMinor)}</Txt>
          <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm }}>
            {v.lowMinor !== v.highMinor ? `${money(v.lowMinor)}–${money(v.highMinor)}` : 'estimated'}{v.basis === 'msrp' ? ' · indicative' : ''}
          </Txt>
          <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.xs, marginTop: 4 }}>
            An estimate from our market — the real price is set at a free inspection.
          </Txt>
        </View>
      ) : (
        <Muted size={t.size.sm}>Added. We’ll estimate its value as similar gear sells on TrueGlaz.</Muted>
      )}
      <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
        <Button label="Add another" variant="ghost" onPress={onAddAnother} style={{ flex: 1 }} />
        <Button label="Open Vault" onPress={onOpen} style={{ flex: 1 }} />
      </View>
      <Button label="Done" variant="ghost" onPress={onDone} />
    </>
  )
}
