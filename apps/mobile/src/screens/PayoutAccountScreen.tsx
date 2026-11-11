import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { api, dateOnly, useApi } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { OtpBoxes } from '../components/OtpBoxes'
import { CodeTimer } from '../components/CodeTimer'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Badge, Card, ErrorNote, Loading, Muted, SectionTitle } from '../components/ui'

type Method = 'upi' | 'bank'

export function PayoutAccountScreen() {
  const t = useTheme()
  const acct = useApi(() => api.myPayoutAccount(), [])
  const [editing, setEditing] = useState(false)

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
      {acct.error && <ErrorNote error={acct.error} onRetry={acct.reload} />}
      {acct.loading && !acct.data && <Loading />}

      {acct.data && !editing && (
        <Card style={{ gap: t.space.x2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionTitle>Current payout account</SectionTitle>
            <Badge
              label={({ verified: 'Verified', pending: 'Being checked', failed: 'Not accepted' } as Record<string, string>)[acct.data.verificationState] ?? acct.data.verificationState}
              tone={acct.data.verificationState === 'verified' ? 'good' : acct.data.verificationState === 'failed' ? 'bad' : 'warn'}
            />
          </View>
          <Line label="Method" value={acct.data.method === 'upi' ? 'UPI' : 'Bank account'} />
          <Line label="Account holder" value={acct.data.accountHolderName} />
          {acct.data.method === 'upi'
            ? <Line label="UPI id" value={acct.data.upiVpa ?? '—'} />
            : <>
                <Line label="Account" value={acct.data.accountLast4 ? `•••• ${acct.data.accountLast4}` : '—'} />
                <Line label="IFSC" value={acct.data.ifsc ?? '—'} />
              </>}
          {acct.data.verifiedAt && <Line label="Since" value={dateOnly(acct.data.verifiedAt)} />}
          {acct.data.nameAtBank && <Line label="Name at your bank" value={acct.data.nameAtBank} />}
          {acct.data.verificationState === 'pending' && (
            <Muted size={t.size.xs}>
              {acct.data.nameAtBank
                ? `Your bank's name for this account doesn't clearly match ${acct.data.checkedAgainstName ?? 'your verified name'}. `
                : "We couldn't confirm the name with your bank just now. "}
              Our team will check it within a working day; payouts wait until then.
            </Muted>
          )}
          {acct.data.verificationState === 'failed' && (
            <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>
              {acct.data.reviewReason ?? 'Our team could not accept this account.'} Add an account in your own name.
            </Txt>
          )}
        </Card>
      )}

      {editing
        ? <PayoutForm onDone={() => { setEditing(false); acct.reload() }} onCancel={() => setEditing(false)} />
        : (
          <>
            {!acct.data && (
              <Card style={{ gap: t.space.x2 }}>
                <SectionTitle>No payout account yet</SectionTitle>
                <Muted>Add where we should send your money once your gear sells.</Muted>
              </Card>
            )}
            <Button label={acct.data ? 'Change payout account' : 'Add payout account'} onPress={() => setEditing(true)} />
            <Muted size={t.size.xs}>
              For your security, saving a payout account needs a one-time code we send to the email or phone already on your account.
            </Muted>
          </>
        )}
    </ScrollView>
  )
}

function PayoutForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useTheme()
  const [method, setMethod] = useState<Method>('upi')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [upiVpa, setUpiVpa] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')

  const [codeSent, setCodeSent] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [deadline, setDeadline] = useState(0)
  const [resendAt, setResendAt] = useState(0)
  const [expired, setExpired] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detailsOk = () => {
    if (!accountHolderName.trim()) { setError("The account holder's name is required."); return false }
    if (method === 'upi' && !upiVpa.trim()) { setError('Enter your UPI id (looks like name@bank).'); return false }
    if (method === 'bank' && (!accountNumber.trim() || !ifsc.trim())) { setError('Enter the account number and IFSC.'); return false }
    return true
  }

  const sendCode = async () => {
    if (!detailsOk()) return
    setError(null); setBusy(true)
    try {
      const res = await api.requestPayoutCode()
      setDevCode(res.devCode); setSentTo(res.contact); setCodeSent(true)
      setCode(res.devCode ?? '')
      setDeadline(Date.now() + (res.expiresInSeconds ?? Math.max(1, Math.round((Date.parse(res.expiresAt) - Date.now()) / 1000))) * 1000)
      setResendAt(Date.now() + (res.resendInSeconds ?? 60) * 1000)
      setExpired(false)
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const save = async () => {
    if (code.replace(/\D/g, '').length < 4) { setError('Enter the code we sent you.'); return }
    setError(null); setBusy(true)
    try {
      await api.savePayoutAccount({
        code: code.replace(/\D/g, ''),
        method,
        accountHolderName: accountHolderName.trim(),
        accountNumber: method === 'bank' ? accountNumber.trim() : null,
        ifsc: method === 'bank' ? ifsc.trim() : null,
        upiVpa: method === 'upi' ? upiVpa.trim() : null,
      })
      onDone()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Card style={{ gap: t.space.x3 }}>
      <SectionTitle>Payout account</SectionTitle>

      <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
        {(['upi', 'bank'] as Method[]).map((m) => {
          const on = method === m
          return (
            <Pressable key={m} onPress={() => { setMethod(m); setError(null) }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: t.space.x2, borderRadius: t.radius.pill, borderWidth: 1, backgroundColor: on ? t.colors.accentSoft : t.colors.bg, borderColor: on ? t.colors.accent : t.colors.border }}>
              <Txt style={{ color: on ? t.colors.accent : t.colors.text, fontSize: t.size.sm }}>{m === 'upi' ? 'UPI' : 'Bank account'}</Txt>
            </Pressable>
          )
        })}
      </View>

      <Field label="Account holder name" value={accountHolderName} onChangeText={setAccountHolderName} />
      {method === 'upi'
        ? <Field label="UPI id" value={upiVpa} onChangeText={setUpiVpa} autoCapitalize="none" placeholder="name@bank" />
        : <>
            <Field label="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" />
            <Field label="IFSC" value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" placeholder="e.g. HDFC0001234" />
          </>}

      {codeSent && (
        <View style={{ gap: t.space.x3 }}>
          {sentTo && <Muted size={t.size.xs}>We sent a code to {sentTo}.</Muted>}
          {devCode && (
            <View style={{ backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md, padding: t.space.x3 }}>
              <Txt style={{ color: t.colors.accent, fontWeight: t.weight.bold as never }}>Demo code: {devCode}</Txt>
            </View>
          )}
          <OtpBoxes value={code} onChange={setCode} label="Verification code" editable={!expired} />
          <CodeTimer key={deadline} deadline={deadline} resendAt={resendAt} onResend={sendCode} resending={busy} align="flex-start"
            onExpire={() => { setExpired(true); setCode('') }} />
        </View>
      )}

      {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}

      {codeSent && !expired
        ? <Button label="Save payout account" loading={busy} onPress={save} />
        : !codeSent && <Button label="Send verification code" loading={busy} onPress={sendCode} />}
      <Button label="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.space.x3 }}>
      <Muted>{label}</Muted>
      <Txt style={{ color: t.colors.text, flexShrink: 1, textAlign: 'right' }}>{value}</Txt>
    </View>
  )
}
