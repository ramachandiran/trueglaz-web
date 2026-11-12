import { useState } from 'react'
import { Alert, Linking, Pressable, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import {
  api, ApiError, money, dateOnly, useApi, dayName, coverBasisText, insuranceOwnerStatus, insuranceStep,
  INSURANCE_STEPS, CALL_TIMES,
  type VaultItem, type InsuranceDocument, type InsuranceTerms, type CallTime, type Tone,
} from '@trueglaz/core'
import { Txt } from './Txt'
import { BottomSheet } from './BottomSheet'
import { Chip, Pill } from './kit'
import { Button, Field } from './form'
import { ErrorNote, Loading, Muted } from './ui'
import { useTheme } from '../theme/ThemeContext'
import { PushPrompt } from './PushPrompt'
import { encField, isUnlocked } from '../state/vaultKey'

/**
 * Insurance on a vault card, as a quote referral: TrueGlaz is not the insurer
 * or an agent. The owner reads the terms, sends the invoice, a licensed agent
 * calls them, and they add the policy they bought for us to check and keep.
 */

const TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_BYTES = 10 * 1024 * 1024

export async function openInsuranceDocument(docId: string) {
  try { const { url } = await api.insuranceDocumentLink(docId); await Linking.openURL(url) }
  catch (e) { Alert.alert('Could not open it', e instanceof ApiError ? e.message : 'Please try again') }
}

function useTone() {
  const t = useTheme()
  return (tone: Tone) => tone === 'good' ? { fg: t.colors.good, bg: t.colors.goodSoft }
    : tone === 'warn' ? { fg: t.colors.warn, bg: t.colors.warnSoft }
    : tone === 'bad' ? { fg: t.colors.bad, bg: t.colors.badSoft }
    : { fg: t.colors.text, bg: t.colors.bgSunken }
}

function Badge({ label, tone, icon }: { label: string; tone: Tone; icon?: React.ComponentProps<typeof Ionicons>['name'] }) {
  const t = useTheme()
  const c = useTone()(tone)
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.bg, borderRadius: t.radius.pill, paddingVertical: 4, paddingHorizontal: 10 }}>
      {icon && <Ionicons name={icon} size={13} color={c.fg} />}
      <Txt style={{ color: c.fg, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>{label}</Txt>
    </View>
  )
}

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      <Txt style={{ color: t.colors.accent, fontSize: t.size.sm, fontWeight: t.weight.bold as never, textDecorationLine: 'underline' }}>{label}</Txt>
    </Pressable>
  )
}

/** The insurance part of a gear card: one clear state and the next thing to do. */
export function CoverRow({ item, onQuote, onAddPolicy, onClaimHelp, onChanged }: {
  item: VaultItem; onQuote: () => void; onAddPolicy: () => void; onClaimHelp: () => void; onChanged: () => void
}) {
  const t = useTheme()
  const r = item.insuranceRequest
  const p = item.policy

  function withdraw() {
    Alert.alert('Withdraw request', 'Withdraw your insurance quote request?', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: async () => {
        try { await api.withdrawInsurance(item.id); onChanged() }
        catch (e) { Alert.alert('Could not withdraw', e instanceof ApiError ? e.message : 'Please try again') }
      } },
    ])
  }

  const divider = <View style={{ height: 1, backgroundColor: t.colors.border, marginVertical: t.space.x3 }} />

  if (r) {
    const s = insuranceOwnerStatus(r)
    const step = insuranceStep(r.status)
    return (
      <View>
        {divider}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge label={s.label} tone={s.tone} icon={s.tone === 'warn' ? 'time' : s.tone === 'bad' ? 'alert-circle' : 'document-text'} />
          {!!s.hint && !r.reuploadReason && <Muted size={t.size.xs}>{s.hint}</Muted>}
        </View>
        {!!r.reuploadReason && <Txt style={{ color: t.colors.text, fontSize: t.size.xs, marginTop: 8 }}>{r.reuploadReason}</Txt>}
        {r.source === 'quote' && (
          <View style={{ flexDirection: 'row', marginTop: 14 }} accessibilityLabel={`Step ${Math.min(step + 1, 4)} of 4: ${INSURANCE_STEPS[Math.min(step, 3)]}`}>
            {INSURANCE_STEPS.map((label, i) => {
              const done = i <= step
              return (
                <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                  {i > 0 && <View style={{ position: 'absolute', top: 6, right: '50%', width: '100%', height: 2, backgroundColor: done ? t.colors.cta : t.colors.bgSunken }} />}
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: done ? t.colors.cta : t.colors.bgSunken,
                    borderWidth: i === step ? 3 : 0, borderColor: t.colors.accentSoft }} />
                  <Txt style={{ fontSize: 10.5, marginTop: 5, textAlign: 'center', color: done ? t.colors.text : t.colors.textMuted, fontWeight: (done ? t.weight.bold : t.weight.normal) as never }}>{label}</Txt>
                </View>
              )
            })}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: t.space.x2, marginTop: t.space.x3, alignItems: 'center', flexWrap: 'wrap' }}>
          {r.status === 'requested' || r.status === 'with_agent' ? (
            <>
              <View style={{ flex: 1 }}><Pill label="Submitted for quote" icon="checkmark" small block variant="ghost" disabled /></View>
              <Pill label="Add policy" small variant="ghost" onPress={onAddPolicy} />
            </>
          ) : r.status === 'quote_shared' ? (
            <View style={{ flex: 1 }}><Pill label={r.reuploadReason ? 'Upload policy again' : 'Add your policy'} icon="cloud-upload-outline" small block onPress={onAddPolicy} /></View>
          ) : (
            <View style={{ flex: 1 }}><Pill label="Policy sent for checking" small block variant="ghost" disabled /></View>
          )}
        </View>
        {(r.status === 'requested' || r.status === 'with_agent' || (r.status === 'quote_shared' && !r.reuploadReason)) && (
          <View style={{ marginTop: 10 }}><LinkText label={r.status === 'quote_shared' ? 'Not buying it' : 'Withdraw request'} onPress={withdraw} /></View>
        )}
      </View>
    )
  }

  if (p) {
    const renewSoon = new Date(p.expiresOn).getTime() - Date.now() < 60 * 864e5
    return (
      <View>
        {divider}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Badge label="Insured" tone="good" icon="shield-checkmark" />
          <Muted size={t.size.xs}>until {dateOnly(p.expiresOn)}</Muted>
        </View>
        <View style={{ flexDirection: 'row', gap: t.space.x4, marginTop: 10 }}>
          <View style={{ flex: 1 }}><Muted size={t.size.xs}>Insurer</Muted><Txt style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{p.insurerName ?? '—'}</Txt></View>
          <View><Muted size={t.size.xs}>Cover</Muted><Txt style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never }}>{money(p.sumInsuredMinor)}</Txt></View>
        </View>
        <View style={{ flexDirection: 'row', gap: t.space.x4, marginTop: 12, alignItems: 'center' }}>
          {p.documentId && <LinkText label="Policy document" onPress={() => openInsuranceDocument(p.documentId!)} />}
          <LinkText label="How to claim" onPress={onClaimHelp} />
        </View>
        {renewSoon && <View style={{ marginTop: 12 }}><Pill label="Add renewed policy" small block onPress={onAddPolicy} /></View>}
      </View>
    )
  }

  return (
    <View>
      {divider}
      <Pill label="Get insurance quote" icon="shield-outline" small block onPress={onQuote} />
      <View style={{ marginTop: 10, alignItems: 'center' }}><LinkText label="Already insured? Add your policy" onPress={onAddPolicy} /></View>
    </View>
  )
}

// -- quote request ------------------------------------------------------------------

export function QuoteSheet({ item, onClose, onDone }: { item: VaultItem; onClose: () => void; onDone: () => void }) {
  const t = useTheme()
  const start = useApi(() => api.insuranceStart(item.id), [item.id])
  const [step, setStep] = useState<1 | 2>(1)
  const [accepted, setAccepted] = useState(false)
  const [consent, setConsent] = useState(false)
  const [invoice, setInvoice] = useState<InsuranceDocument | null>(null)
  const [cover, setCover] = useState<string | null>(null)
  const [callTime, setCallTime] = useState<CallTime | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  // The serial, typed here when the item has none yet (TG-102); saved to the vault item.
  const [serialIn, setSerialIn] = useState('')
  const [serialSaving, setSerialSaving] = useState(false)

  const s = start.data
  const serialLocked = !!item.e2ee && !isUnlocked()
  async function saveSerial() {
    const v = serialIn.trim()
    if (v.length < 3) { setErr('Enter the serial number as printed on the item.'); return }
    setSerialSaving(true); setErr(null)
    try {
      await api.updateGear(item.id, item.e2ee ? { serialCipher: encField(v) } : { serial: v })
      setSerialIn(''); start.reload()
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not save the serial number') }
    finally { setSerialSaving(false) }
  }
  const coverValue = cover ?? (s?.coverSuggestionMinor ? String(Math.round(s.coverSuggestionMinor / 100)) : '')
  const coverMinor = Math.round((parseFloat(coverValue.replace(/,/g, '')) || 0) * 100)
  const blocker = !s ? null
    : !s.hasSerial && serialLocked ? 'Unlock your vault to add the serial number — insurers put it on the policy.'
    : !s.hasSerial ? 'Add the serial number below — insurers put it on the policy.'
    : !s.phoneHint ? 'Add your phone number in Profile so the agent can call you.'
    : null
  const canSend = !!s && !blocker && (!!invoice || !!s.trueglazInvoice) && coverMinor > 0 && !!callTime && consent && !busy

  async function send() {
    if (!s || !callTime) return
    setBusy(true); setErr(null)
    try {
      const r = await api.requestInsuranceQuote(item.id, {
        invoiceDocumentId: invoice?.id ?? null, coverMinor, callTime,
        termsVersion: s.terms.version, acceptedTerms: accepted, consentToShare: consent,
      })
      setDone(r.replyBy ? dayName(r.replyBy) : '')
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not send the request') }
    finally { setBusy(false) }
  }

  if (done !== null) {
    return (
      <Sheet title="Quote requested" onClose={onDone}>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: t.space.x3 }}>
          <Ionicons name="checkmark-circle" size={56} color={t.colors.good} />
          <Txt style={{ color: t.colors.text, fontSize: t.size.md, fontWeight: t.weight.bold as never, textAlign: 'center' }}>
            A licensed agent will call you{done ? ` by ${done}` : ''} with a price.
          </Txt>
          <Muted size={t.size.sm} style={{ textAlign: 'center' }}>You pay them directly — TrueGlaz takes no payment. Once you buy, add the policy here.</Muted>
        </View>
        <PushPrompt reason="We'll tell you when the agent has your quote." />
        <Pill label="Done" block onPress={onDone} />
      </Sheet>
    )
  }

  return (
    <Sheet title={step === 1 ? 'Before you ask' : 'Your details'} kicker={`Insurance quote · step ${step} of 2`} onClose={onClose}
      footer={s ? (step === 1 ? (
        <>
          <Check on={accepted} onToggle={() => setAccepted(!accepted)} label={s.terms.acceptance} />
          <Pill label="Continue" block disabled={!accepted} onPress={() => setStep(2)} />
        </>
      ) : (
        <>
          <Check on={consent} onToggle={() => setConsent(!consent)} label={s.terms.consent} />
          {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
          <Pill label={busy ? 'Sending…' : 'Request quote'} block disabled={!canSend} onPress={send} />
          <Muted size={t.size.xs} style={{ textAlign: 'center' }}>No payment now. You pay the insurer directly.</Muted>
        </>
      )) : undefined}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: t.colors.cta }} />
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: step === 2 ? t.colors.cta : t.colors.bgSunken }} />
      </View>
      {start.loading && <Loading />}
      {start.error && <ErrorNote error={start.error} />}
      {s && step === 1 && (
        <>
          <Txt style={{ color: t.colors.text, fontWeight: t.weight.bold as never }}>{item.modelLabel}</Txt>
          <Section title="How it works" />
          {s.terms.howItWorks.map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.bgSunken, alignItems: 'center', justifyContent: 'center' }}>
                <Txt style={{ color: t.colors.accent, fontSize: t.size.xs, fontWeight: t.weight.bold as never }}>{i + 1}</Txt>
              </View>
              <Txt style={{ color: t.colors.text, fontSize: t.size.sm, flex: 1 }}>{i === 1 ? h.replace('within 3 working days', `by ${dayName(s.replyBy)}`) : h}</Txt>
            </View>
          ))}
          <Section title={`Key terms · ${s.terms.title}`} />
          <TermsList terms={s.terms} />
          <LinkText label="Read the full policy wording (PDF)" onPress={() => Linking.openURL(s.terms.wordingUrl)} />
        </>
      )}
      {s && step === 2 && (
        <>
          {blocker && <Txt style={{ color: t.colors.text, backgroundColor: t.colors.badSoft, padding: 10, borderRadius: t.radius.md, fontSize: t.size.sm }}>{blocker}</Txt>}
          <Section title="Serial number" required />
          {s.hasSerial ? (
            <FileBox ok title={s.serialLast4 ? `Serial ending ${s.serialLast4}` : 'Serial number on file'}
              sub={item.fromTrueglaz ? 'From our inspection of this unit' : 'From your vault'} />
          ) : !serialLocked && (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Field label="As printed on the item" value={serialIn} onChangeText={setSerialIn} autoCapitalize="characters"
                  autoCorrect={false} returnKeyType="done" onSubmitEditing={saveSerial} />
              </View>
              <Button label={serialSaving ? 'Saving…' : 'Save'} variant="cta" onPress={saveSerial} loading={serialSaving} />
            </View>
          )}
          <Section title="Purchase invoice" required />
          {s.trueglazInvoice && !invoice ? (
            <FileBox ok title={`TrueGlaz invoice ${s.trueglazInvoice.number}`} sub="Attached for you — bought on TrueGlaz" />
          ) : (
            <FilePick itemId={item.id} kind="invoice" doc={invoice} onDoc={setInvoice} />
          )}
          <Muted size={t.size.xs}>PDF or photo. It should show the seller, date, price and serial number.</Muted>
          <Field label={`${coverBasisText(s.coverBasis)} (₹)`} keyboardType="numeric" value={coverValue}
            onChangeText={(v: string) => setCover(v.replace(/[^\d.,]/g, ''))} />
          <Muted size={t.size.xs}>Insurers pay in full only if you insure at the price of a new one. Your agent confirms it.</Muted>
          <Section title="Best time to call you" />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {CALL_TIMES.map((c) => <Chip key={c.value} label={c.label} on={callTime === c.value} onPress={() => setCallTime(c.value)} />)}
          </View>
          {s.phoneHint && <Muted size={t.size.xs}>We'll call {s.phoneHint} (your profile number).</Muted>}
        </>
      )}
    </Sheet>
  )
}

// -- add policy ----------------------------------------------------------------------

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function PolicySheet({ item, onClose, onDone }: { item: VaultItem; onClose: () => void; onDone: () => void }) {
  const t = useTheme()
  const r = item.insuranceRequest
  const [doc, setDoc] = useState<InsuranceDocument | null>(null)
  const [insurer, setInsurer] = useState(r?.submittedPolicy?.insurerName ?? '')
  const [no, setNo] = useState(r?.submittedPolicy?.policyNo ?? '')
  const [starts, setStarts] = useState('')
  const [ends, setEnds] = useState('')
  const [cover, setCover] = useState(r?.coverMinor ? String(Math.round(r.coverMinor / 100)) : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const coverMinor = Math.round((parseFloat(cover.replace(/,/g, '')) || 0) * 100)
  const can = !!doc && !!insurer.trim() && !!no.trim() && ISO.test(starts) && ISO.test(ends) && coverMinor > 0 && !busy

  function onStarts(v: string) {
    setStarts(v)
    if (ISO.test(v) && !ends) {
      const d = new Date(v); d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1)
      if (!Number.isNaN(d.getTime())) setEnds(d.toISOString().slice(0, 10))
    }
  }

  async function save() {
    if (!doc) return
    setBusy(true); setErr(null)
    try {
      await api.addInsurancePolicy(item.id, { policyDocumentId: doc.id, insurerName: insurer.trim(), policyNo: no.trim(), startsOn: starts, endsOn: ends, sumInsuredMinor: coverMinor })
      setDone(true)
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Could not add the policy') }
    finally { setBusy(false) }
  }

  if (done) {
    return (
      <Sheet title="Policy sent for checking" onClose={onDone}>
        <Muted size={t.size.sm}>We check it matches your {item.modelLabel} within a working day. Then it shows as insured, and we remind you 30 days before it ends.</Muted>
        <Pill label="Done" block onPress={onDone} />
      </Sheet>
    )
  }

  return (
    <Sheet title="Bought the cover?" kicker="Add your policy" onClose={onClose}
      footer={<>
        {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{err}</Txt>}
        <Pill label={busy ? 'Saving…' : 'Add policy'} block disabled={!can} onPress={save} />
        <Muted size={t.size.xs} style={{ textAlign: 'center' }}>We'll remind you 30 days before it ends.</Muted>
      </>}>
      {!!r?.reuploadReason && (
        <Txt style={{ color: t.colors.text, backgroundColor: t.colors.badSoft, padding: 10, borderRadius: t.radius.md, fontSize: t.size.sm }}>
          We need it again: {r.reuploadReason}
        </Txt>
      )}
      <Muted size={t.size.sm}>Upload the policy the insurer sent you, then copy these details from it.</Muted>
      <Section title="Policy document" required />
      <FilePick itemId={item.id} kind="policy" doc={doc} onDoc={setDoc} />
      <Field label="Insurer" placeholder="e.g. New India Assurance" value={insurer} onChangeText={setInsurer} />
      <Field label="Policy number" value={no} onChangeText={setNo} />
      <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
        <View style={{ flex: 1 }}><Field label="Starts (YYYY-MM-DD)" placeholder="2026-11-14" value={starts} onChangeText={onStarts} /></View>
        <View style={{ flex: 1 }}><Field label="Ends (YYYY-MM-DD)" placeholder="2027-11-13" value={ends} onChangeText={setEnds} /></View>
      </View>
      <Field label="Cover amount on the policy (₹)" keyboardType="numeric" value={cover} onChangeText={(v: string) => setCover(v.replace(/[^\d.,]/g, ''))} />
    </Sheet>
  )
}

export function ClaimSheet({ onClose }: { onClose: () => void }) {
  const t = useTheme()
  const terms = useApi(() => api.insuranceTerms(), [])
  return (
    <Sheet title="How to claim" onClose={onClose} footer={<Pill label="Got it" block onPress={onClose} />}>
      {terms.loading && <Loading />}
      {terms.data?.claimSteps.map((c, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never, width: 18 }}>{i + 1}.</Txt>
          <Txt style={{ color: t.colors.text, fontSize: t.size.sm, flex: 1 }}>{c}</Txt>
        </View>
      ))}
      <Muted size={t.size.xs}>Your claim is with the insurer, not TrueGlaz. Your policy, invoice and vault record stay here for you.</Muted>
    </Sheet>
  )
}

// -- bits --------------------------------------------------------------------------------

function TermsList({ terms }: { terms: InsuranceTerms }) {
  const t = useTheme()
  return (
    <View style={{ gap: 8 }}>
      {terms.points.map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <Ionicons size={16}
            name={p.kind === 'covered' ? 'checkmark-circle' : p.kind === 'excluded' ? 'close-circle' : 'alert-circle'}
            color={p.kind === 'covered' ? t.colors.good : p.kind === 'excluded' ? t.colors.bad : t.colors.warn}
            accessibilityLabel={p.kind === 'covered' ? 'Covered' : p.kind === 'excluded' ? 'Not covered' : 'Rule'} />
          <Txt style={{ color: t.colors.text, fontSize: t.size.sm, flex: 1 }}>{p.text}</Txt>
        </View>
      ))}
    </View>
  )
}

function Section({ title, required }: { title: string; required?: boolean }) {
  const t = useTheme()
  return (
    <Txt style={{ color: t.colors.text, fontSize: t.size.sm, fontWeight: t.weight.bold as never, marginTop: 4 }}>
      {title}{required ? <Txt style={{ color: t.colors.accent, fontSize: t.size.xs }}>  Required</Txt> : null}
    </Txt>
  )
}

export function Check({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  const t = useTheme()
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, marginTop: 1,
        borderColor: on ? t.colors.cta : t.colors.textMuted, backgroundColor: on ? t.colors.cta : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on && <Ionicons name="checkmark" size={15} color={t.colors.onCta} />}
      </View>
      <Txt style={{ color: t.colors.text, fontSize: t.size.xs, flex: 1, lineHeight: 18 }}>{label}</Txt>
    </Pressable>
  )
}

function FileBox({ ok, title, sub, action, onAction }: { ok?: boolean; title: string; sub: string; action?: string; onAction?: () => void }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12,
      borderWidth: 1.5, borderStyle: ok ? 'solid' : 'dashed', borderColor: ok ? t.colors.good : t.colors.border, backgroundColor: ok ? t.colors.goodSoft : 'transparent' }}>
      <Ionicons name={ok ? 'document-attach' : 'cloud-upload-outline'} size={24} color={ok ? t.colors.good : t.colors.textMuted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt numberOfLines={1} style={{ color: t.colors.text, fontWeight: t.weight.bold as never, fontSize: t.size.sm }}>{title}</Txt>
        <Muted size={t.size.xs}>{sub}</Muted>
      </View>
      {action && <LinkText label={action} onPress={onAction!} />}
    </View>
  )
}

/** A PDF from Files, or a photo taken now (sent as a JPEG). Uploaded straight away. */
function FilePick({ itemId, kind, doc, onDoc }: {
  itemId: string; kind: 'invoice' | 'policy'; doc: InsuranceDocument | null; onDoc: (d: InsuranceDocument) => void
}) {
  const t = useTheme()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function upload(uri: string, type: string, name: string, size?: number) {
    if (!TYPES.includes(type)) { setErr('Choose a PDF, JPG or PNG'); return }
    if (size && size > MAX_BYTES) { setErr('That file is over 10 MB'); return }
    setBusy(true); setErr(null)
    try {
      const blob = await (await fetch(uri)).blob()
      onDoc(await api.uploadInsuranceDocument(itemId, kind, blob, type, name))
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'The upload did not go through') }
    finally { setBusy(false) }
  }

  async function pickFile() {
    const r = await DocumentPicker.getDocumentAsync({ type: TYPES, copyToCacheDirectory: true, multiple: false })
    if (r.canceled || !r.assets?.[0]) return
    const a = r.assets[0]
    const type = a.mimeType ?? (/\.pdf$/i.test(a.name) ? 'application/pdf' : /\.png$/i.test(a.name) ? 'image/png' : 'image/jpeg')
    await upload(a.uri, type, a.name, a.size)
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { setErr('Allow the camera to take a photo of it'); return }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (r.canceled || !r.assets?.[0]) return
    const a = r.assets[0]
    // Phone photos are often HEIC: send a JPEG at most 2000px wide.
    const out = await ImageManipulator.manipulateAsync(a.uri, a.width && a.width > 2000 ? [{ resize: { width: 2000 } }] : [],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG })
    await upload(out.uri, 'image/jpeg', `${kind}-photo.jpg`)
  }

  const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

  return (
    <View style={{ gap: 8 }}>
      {doc ? (
        <FileBox ok title={doc.fileName ?? (kind === 'invoice' ? 'Invoice' : 'Policy')} sub={`${size(doc.bytes)} · uploaded`} action="Change" onAction={pickFile} />
      ) : (
        <>
          <Pressable onPress={busy ? undefined : pickFile} accessibilityRole="button">
            <FileBox title={busy ? 'Uploading…' : kind === 'invoice' ? 'Upload purchase invoice' : 'Upload policy document'} sub="PDF, JPG or PNG · up to 10 MB" />
          </Pressable>
          <View style={{ alignItems: 'flex-start' }}><Button label="Take a photo instead" variant="ghost" onPress={takePhoto} disabled={busy} style={{ paddingVertical: 6, paddingHorizontal: 12 }} /></View>
        </>
      )}
      {err && <Txt style={{ color: t.colors.bad, fontSize: t.size.xs }}>{err}</Txt>}
    </View>
  )
}

/** A bottom sheet with an optional kicker and a fixed footer for the main action. */
export function Sheet({ title, kicker, onClose, footer, children }: {
  title: string; kicker?: string; onClose: () => void; footer?: React.ReactNode; children: React.ReactNode
}) {
  const t = useTheme()
  return (
    <BottomSheet onClose={onClose} background={t.colors.bg} maxHeight="92%" footer={footer} scroll>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: t.space.x1 }}>
        <View style={{ flex: 1 }}>
          {kicker && <Txt style={{ color: t.colors.accent, fontSize: 11, fontWeight: t.weight.bold as never, letterSpacing: 1.2, textTransform: 'uppercase' }}>{kicker}</Txt>}
          <Txt accessibilityRole="header" style={{ color: t.colors.text, fontSize: kicker ? 24 : t.size.lg, fontWeight: t.weight.bold as never }}>{title}</Txt>
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><Txt style={{ color: t.colors.textMuted, fontSize: t.size.xl }}>×</Txt></Pressable>
      </View>
      {children}
    </BottomSheet>
  )
}
