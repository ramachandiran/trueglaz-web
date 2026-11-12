import { useEffect, useMemo, useState } from 'react'
import { VaultIntro } from './VaultIntro'
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import Ionicons from '@expo/vector-icons/Ionicons'
import {
  api, money, dateOnly, useApi, ApiError,
  type VaultItem, type ProductModel,
} from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { PageTitle, Pill, RoundIcon, Surface } from '../components/kit'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Empty, ErrorNote, Loading, Muted } from '../components/ui'
import { ClaimSheet, CoverRow, PolicySheet, QuoteSheet, Sheet } from '../components/VaultCover'
import { ModelThumb, useModelImages } from '../components/ModelImage'
import {
  isE2eeOn, isUnlocked, lockVault, ensureLoaded, decField, encField,
  enableE2ee, unlockVault, changePin, recoverVault, disableE2ee,
} from '../state/vaultKey'

/** The midpoint estimate, or the purchase cost when there is no valuation yet. */
function estimate(it: VaultItem): number {
  return it.valuation?.midMinor ?? it.costMinor ?? 0
}

/** The sensitive fields as the owner should see them, decrypting if unlocked. */
function shownSerial(it: VaultItem): string | null {
  if (!it.e2ee) return it.serial
  if (it.serialCipher && isUnlocked()) { try { return decField(it.serialCipher) } catch { return null } }
  return null
}
function shownCost(it: VaultItem): number | null {
  if (!it.e2ee) return it.costMinor
  if (it.costCipher && isUnlocked()) {
    try { const n = parseInt(decField(it.costCipher), 10); return Number.isFinite(n) ? n : null } catch { return null }
  }
  return null
}
function hasLockedFields(it: VaultItem): boolean {
  return it.e2ee && !isUnlocked() && (it.serialCipher != null || it.costCipher != null || it.notesCipher != null)
}

type PrivacyMode = 'setup' | 'unlock' | 'change' | 'recover' | 'disable'

const WARRANTY_LABEL: Record<VaultItem['warrantyStatus'], string> = {
  active: 'Under warranty', expiring: 'Warranty ending soon', expired: 'Warranty expired', unknown: 'Warranty unknown',
}

export function VaultScreen() {
  const t = useTheme()
  const pictures = useModelImages()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi(() => api.vault(), [])
  const [adding, setAdding] = useState(false)
  const [insuring, setInsuring] = useState<{ item: VaultItem; what: 'quote' | 'policy' | 'claim' } | null>(null)
  const [privacy, setPrivacy] = useState<PrivacyMode | null>(null)
  const [, setPTick] = useState(0)
  const rePrivacy = () => setPTick((n) => n + 1)

  useEffect(() => { ensureLoaded().then(rePrivacy) }, [])

  // Opened from Profile's "Get a free quote" (TG-118): straight into that item's quote.
  const route = useRoute<any>()
  const nav = useNavigation<any>()
  const quoteFor: string | undefined = route.params?.quoteFor
  useEffect(() => {
    if (!quoteFor || !data) return
    const it = data.find((i) => i.id === quoteFor)
    if (it) setInsuring({ item: it, what: 'quote' })
    nav.setParams({ quoteFor: undefined })
  }, [quoteFor, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const e2ee = isE2eeOn()
  const unlocked = isUnlocked()
  const items = data ?? []
  const total = useMemo(() => items.reduce((n, it) => n + estimate(it), 0), [items])
  const insured = items.filter((i) => i.policy).length
  // Asked for a quote or sent a policy: say so, not "0 insured".
  const issuing = items.filter((i) => !i.policy && i.insuranceRequest).length

  function afterPrivacy() { setPrivacy(null); rePrivacy(); reload() }

  function remove(item: VaultItem) {
    Alert.alert('Remove gear', `Remove ${item.modelLabel} from your vault?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { try { await api.removeGear(item.id); reload() } catch { /* ignore */ } } },
    ])
  }

  const warrantyTone = (s: VaultItem['warrantyStatus']) =>
    s === 'active' ? { fg: t.colors.good, bg: t.colors.goodSoft }
      : s === 'expiring' ? { fg: t.colors.warn, bg: t.colors.warnSoft }
      : { fg: t.colors.textMuted, bg: t.colors.bgSunken }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <PageTitle title="Gear Vault" sub="What you own, valued from real sales."
        actions={<RoundIcon icon="add" label="Add gear" tone="cta" onPress={() => setAdding(true)} />} />
      <View style={{ height: t.space.x3 }} />

      <View style={{ paddingHorizontal: t.space.x4, paddingBottom: t.space.x2 }}>
        <PrivacyBar
          e2ee={e2ee}
          unlocked={unlocked}
          onSetup={() => setPrivacy('setup')}
          onUnlock={() => setPrivacy('unlock')}
          onRecover={() => setPrivacy('recover')}
          onChange={() => setPrivacy('change')}
          onDisable={() => setPrivacy('disable')}
          onLock={() => { lockVault(); rePrivacy() }}
        />
      </View>

      {loading && !data && <Loading />}
      {error && <View style={{ padding: t.space.x4 }}><ErrorNote error={error} onRetry={reload} /></View>}

      {data && (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={t.colors.accent} />}
          contentContainerStyle={{ padding: t.space.x4, gap: t.space.x3, paddingBottom: insets.bottom + t.space.x6 }}
          ListHeaderComponent={items.length > 0 ? (
            <View style={{ backgroundColor: t.colors.brand, borderRadius: 14, padding: t.space.x5, marginBottom: t.space.x3, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', right: -28, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: '#ffffff10' }} />
              <View style={{ position: 'absolute', right: t.space.x4, top: t.space.x4 }}>
                <Ionicons name="shield-checkmark-outline" size={30} color="#ffffff33" />
              </View>
              <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.sm, fontWeight: t.weight.medium as never }}>Estimated market value</Txt>
              <Txt style={{ color: t.colors.onBrand, fontSize: 34, fontWeight: t.weight.bold as never, letterSpacing: -1, marginTop: 2 }}>~{money(total)}</Txt>
              <Txt style={{ color: t.colors.onBrandMuted, fontSize: t.size.xs, marginTop: 7 }}>
                {items.length} item{items.length === 1 ? '' : 's'} · {coverNote(insured, issuing)} · indicative, final price set at a free inspection
              </Txt>
            </View>
          ) : undefined}
          ListEmptyComponent={<Empty title="Your vault is empty" hint="Add gear you own to track its value, warranty and insurance." />}
          renderItem={({ item }) => {
            const cost = shownCost(item)
            const serial = shownSerial(item)
            const locked = hasLockedFields(item)
            const estVal = item.valuation?.midMinor ?? cost ?? null
            const wt = warrantyTone(item.warrantyStatus)
            return (
              <Surface style={{ padding: t.space.x4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
                  <ModelThumb image={pictures.byId(item.productModelId)} size={72} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt numberOfLines={1} style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never, letterSpacing: -0.2 }}>{item.modelLabel}</Txt>
                    {locked ? (
                      <Txt style={{ color: t.colors.warn, fontSize: t.size.xs, marginTop: 2 }}>🔒 Locked — unlock to see price &amp; serial</Txt>
                    ) : cost != null || serial ? (
                      <Muted size={t.size.xs} style={{ marginTop: 2 }}>
                        {[cost != null ? `Bought ${money(cost)}` : null, item.purchaseDate ? dateOnly(item.purchaseDate) : null, serial ? `ser ••${serial.slice(-4)}` : null].filter(Boolean).join(' · ')}
                      </Muted>
                    ) : null}
                    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7, backgroundColor: wt.bg, borderRadius: t.radius.pill, paddingVertical: 3, paddingHorizontal: 9 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: wt.fg }} />
                      <Txt style={{ color: wt.fg, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>
                        {WARRANTY_LABEL[item.warrantyStatus]}{item.warrantyExpiry && item.warrantyStatus !== 'expired' ? ` · to ${dateOnly(item.warrantyExpiry)}` : ''}
                      </Txt>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, letterSpacing: -0.3 }}>
                      {estVal != null ? `~${money(estVal)}` : locked ? '🔒' : '…'}
                    </Txt>
                    <Muted size={t.size.xs}>est. value</Muted>
                  </View>
                </View>
                <CoverRow item={item} onChanged={reload}
                  onQuote={() => setInsuring({ item, what: 'quote' })}
                  onAddPolicy={() => setInsuring({ item, what: 'policy' })}
                  onClaimHelp={() => setInsuring({ item, what: 'claim' })} />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: t.space.x3 }}>
                  <RoundIcon icon="trash-outline" label={`Remove ${item.modelLabel}`} onPress={() => remove(item)} size={34} />
                </View>
              </Surface>
            )
          }}
        />
      )}

      {adding && (
        <AddModal
          e2ee={e2ee}
          unlocked={unlocked}
          onNeedUnlock={() => { setAdding(false); setPrivacy('unlock') }}
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); reload() }}
        />
      )}
      {insuring?.what === 'quote' && <QuoteSheet item={insuring.item} onClose={() => setInsuring(null)} onDone={() => { setInsuring(null); reload() }} />}
      {insuring?.what === 'policy' && <PolicySheet item={insuring.item} onClose={() => setInsuring(null)} onDone={() => { setInsuring(null); reload() }} />}
      {insuring?.what === 'claim' && <ClaimSheet onClose={() => setInsuring(null)} />}
      {privacy && <PrivacySheet mode={privacy} items={items} onDone={afterPrivacy} onClose={() => setPrivacy(null)} />}
      {/* The Vault's own invitation lives here, not over Home or Shop (UX-02). */}
      <VaultIntro onClosed={reload} />
    </View>
  )
}

// -- privacy -------------------------------------------------------------------

function PrivacyBar({ e2ee, unlocked, onSetup, onUnlock, onRecover, onChange, onDisable, onLock }: {
  e2ee: boolean; unlocked: boolean
  onSetup: () => void; onUnlock: () => void; onRecover: () => void
  onChange: () => void; onDisable: () => void; onLock: () => void
}) {
  const t = useTheme()
  const wrap = (border: string, bg: string) => ({
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    gap: t.space.x2, borderWidth: 1, borderColor: border, backgroundColor: bg,
    borderRadius: t.radius.md, paddingVertical: 8, paddingHorizontal: 12,
  })
  if (!e2ee) {
    return (
      <View style={wrap(t.colors.border, t.colors.bgRaised)}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm, flex: 1 }}>🔓 Standard privacy — only you see your details</Txt>
        <Button label="Add a PIN" variant="ghost" onPress={onSetup} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
      </View>
    )
  }
  if (!unlocked) {
    return (
      <View style={wrap(t.colors.warn, t.colors.bgRaised)}>
        <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm, flex: 1 }}>🔒 Vault locked</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button label="Unlock" onPress={onUnlock} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
          <Button label="Forgot?" variant="ghost" onPress={onRecover} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
        </View>
      </View>
    )
  }
  return (
    <View style={wrap(t.colors.good, t.colors.bgRaised)}>
      <Txt style={{ color: t.colors.textMuted, fontSize: t.size.sm, flex: 1 }}>🔓 Unlocked · PIN protected</Txt>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Button label="Lock" variant="ghost" onPress={onLock} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
        <Button label="Change" variant="ghost" onPress={onChange} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
        <Button label="Off" variant="ghost" onPress={onDisable} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
      </View>
    </View>
  )
}

function PrivacySheet({ mode, items, onDone, onClose }: {
  mode: PrivacyMode; items: VaultItem[]; onDone: () => void; onClose: () => void
}) {
  const t = useTheme()
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<string | null>(null)

  const needsNewPin = mode === 'setup' || mode === 'change' || mode === 'recover'
  const pinOk = /^\d{4,}$/.test(pin)
  const title = {
    setup: 'Turn on extra privacy', unlock: 'Unlock your vault', change: 'Change your PIN',
    recover: 'Recover your vault', disable: 'Turn off extra privacy',
  }[mode]

  async function run() {
    setBusy(true); setErr(null)
    try {
      if (needsNewPin && pin !== pin2) throw new Error('PINs do not match')
      if (mode === 'setup') { setRecovery(await enableE2ee(pin, items)); return }
      if (mode === 'change') { setRecovery(await changePin(pin)); return }
      if (mode === 'recover') { setRecovery(await recoverVault(code, pin)); return }
      if (mode === 'unlock') { await unlockVault(pin); onDone(); return }
      if (mode === 'disable') { await disableE2ee(); onDone(); return }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message
        : mode === 'unlock' ? 'That PIN is not right'
        : mode === 'recover' ? 'That recovery code or PIN is not right'
        : (e as Error).message || 'That did not work')
    } finally { setBusy(false) }
  }

  const disabled = busy || (mode === 'unlock' ? pin.length < 4 : needsNewPin ? !pinOk : false) || (mode === 'recover' && !code.trim())

  return (
    <Sheet title={title} onClose={onClose}>
      {recovery ? (
        <>
          <Muted size={t.size.sm}>Save this recovery code somewhere safe. It is the only way back if you forget your PIN — we can’t reset it for you.</Muted>
          <View style={{ backgroundColor: t.colors.bgSunken, borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md, padding: t.space.x4 }}>
            <Txt selectable style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never, textAlign: 'center', letterSpacing: 1 }}>{recovery}</Txt>
          </View>
          <Button label="I’ve saved it" onPress={onDone} />
        </>
      ) : mode === 'disable' ? (
        <>
          <Muted size={t.size.sm}>This clears the encrypted details (serial, price, notes) you can no longer read, and returns the vault to standard encryption. Your items, values and warranties are kept. Use this only if you’ve lost both your PIN and recovery code.</Muted>
          {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
          <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
            <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button label={busy ? 'Working…' : 'Reset & turn off'} onPress={run} loading={busy} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <>
          {mode === 'setup' && <Muted size={t.size.sm}>Your serial numbers, prices and notes will be encrypted with a PIN only you know — not even TrueGlaz can read them. You’ll need it to view those details.</Muted>}
          {mode === 'recover' && (
            <Field label="Recovery code" placeholder="ABCD-EF12-…" value={code} onChangeText={setCode} autoFocus />
          )}
          <Field label={mode === 'unlock' ? 'Vault PIN' : 'New Vault PIN (4+ digits)'} placeholder="••••"
            secureTextEntry keyboardType="numeric" value={pin} onChangeText={setPin} autoFocus={mode === 'unlock'} />
          {needsNewPin && (
            <Field label="Confirm PIN" placeholder="••••" secureTextEntry keyboardType="numeric" value={pin2} onChangeText={setPin2} />
          )}
          {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
          <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
            <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label={busy ? 'Working…' : mode === 'unlock' ? 'Unlock' : mode === 'recover' ? 'Recover' : mode === 'change' ? 'Change PIN' : 'Turn on'}
              onPress={run} disabled={disabled} loading={busy} style={{ flex: 1 }}
            />
          </View>
        </>
      )}
    </Sheet>
  )
}

// -- add gear ------------------------------------------------------------------

function AddModal({ e2ee, unlocked, onNeedUnlock, onClose, onAdded }: {
  e2ee: boolean; unlocked: boolean; onNeedUnlock: () => void; onClose: () => void; onAdded: () => void
}) {
  const t = useTheme()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ProductModel[]>([])
  const [model, setModel] = useState<ProductModel | null>(null)
  const [serial, setSerial] = useState('')
  const [cost, setCost] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function search(text: string) {
    setQ(text); setModel(null)
    if (text.trim().length < 2) { setResults([]); return }
    try { setResults((await api.searchModels(text.trim(), 8)).content) } catch { setResults([]) }
  }

  const costMinor = cost ? Math.round(parseFloat(cost) * 100) : null
  const hasPrivate = !!serial.trim() || costMinor != null

  async function submit() {
    // In PIN mode, private fields must be encrypted on this device — that needs the key.
    if (e2ee && hasPrivate && !unlocked) { onNeedUnlock(); return }
    setBusy(true); setErr(null)
    try {
      const base = {
        productModelId: model?.id ?? null,
        modelFreeText: model ? null : q.trim() || null,
        purchaseDate: date.trim() || null,
      }
      if (e2ee) {
        await api.addGear({
          ...base,
          serialCipher: serial.trim() ? encField(serial.trim()) : null,
          costCipher: costMinor != null ? encField(String(costMinor)) : null,
        })
      } else {
        await api.addGear({ ...base, serial: serial.trim() || null, costMinor })
      }
      onAdded()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not add that') } finally { setBusy(false) }
  }

  const canSave = (model != null || q.trim().length > 1) && !busy

  return (
    <Sheet title="Add gear" onClose={onClose}>
      <Field label="Model" placeholder="Search the catalogue, or type what it is"
        value={model ? model.name : q} onChangeText={search} autoFocus />
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
      <Field label="Serial number" placeholder={e2ee ? 'Encrypted with your PIN' : 'Kept private & sealed'} value={serial} onChangeText={setSerial} />
      <Field label="What you paid (₹)" placeholder="e.g. 130000" keyboardType="numeric" value={cost} onChangeText={setCost} />
      <Field label="Purchase date (YYYY-MM-DD)" placeholder="2024-06-15" value={date} onChangeText={setDate} />
      <Muted size={t.size.xs}>We’ll estimate its value from our market and work out the warranty from the purchase date.</Muted>
      {e2ee && hasPrivate && !unlocked && <Txt style={{ color: t.colors.warn, fontSize: t.size.xs }}>🔒 Unlock your vault to save the serial and price privately.</Txt>}
      {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
      <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x2 }}>
        <Button label="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
        <Button label={busy ? 'Adding…' : 'Add to vault'} onPress={submit} disabled={!canSave} loading={busy} style={{ flex: 1 }} />
      </View>
    </Sheet>
  )
}

// -- bits ----------------------------------------------------------------------

/** "2 insured", "1 insured · 1 in progress", or "1 insurance request in progress". */
function coverNote(insured: number, open: number): string {
  if (open === 0) return `${insured} insured`
  if (insured > 0) return `${insured} insured · ${open} in progress`
  return `${open} insurance ${open === 1 ? 'request' : 'requests'} in progress`
}
