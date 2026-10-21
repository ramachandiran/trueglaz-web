import { useState } from 'react'
import { Alert, ScrollView, Switch, View } from 'react-native'
import { api, useApi, type Address } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Badge, Card, Empty, ErrorNote, Loading, Muted, SectionTitle } from '../components/ui'

export function AddressesScreen() {
  const t = useTheme()
  const addrs = useApi(() => api.myAddresses(), [])
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const setDefault = async (id: string) => {
    setBusyId(id)
    try { await api.makeDefaultAddress(id); addrs.reload() }
    catch (e) { Alert.alert('Could not set default', (e as Error).message) }
    finally { setBusyId(null) }
  }

  const remove = (a: Address) => {
    Alert.alert('Delete address?', `${a.recipientName}, ${a.line1}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setBusyId(a.id)
          try { await api.removeAddress(a.id); addrs.reload() }
          catch (e) { Alert.alert('Could not delete', (e as Error).message) }
          finally { setBusyId(null) }
        },
      },
    ])
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
      {addrs.error && <ErrorNote error={addrs.error} onRetry={addrs.reload} />}
      {addrs.loading && !addrs.data && <Loading />}
      {addrs.data && addrs.data.length === 0 && !adding && (
        <Empty title="No addresses yet" hint="Add one so we can ship your orders and return gear." />
      )}

      {(addrs.data ?? []).map((a) => (
        <Card key={a.id} style={{ gap: t.space.x2, borderColor: a.isDefault ? t.colors.accent : t.colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.space.x2 }}>
            <Txt numberOfLines={1} style={{ color: t.colors.text, fontWeight: t.weight.bold as never, flex: 1 }}>
              {a.label || a.recipientName}
            </Txt>
            {a.isDefault && <Badge label="Default" tone="accent" />}
          </View>
          <Muted size={t.size.sm}>
            {a.recipientName}{'\n'}
            {a.line1}{a.line2 ? `, ${a.line2}` : ''}{'\n'}
            {a.city}{a.state ? `, ${a.state}` : ''} {a.pincode}
            {a.phoneE164 ? `\n${a.phoneE164}` : ''}
          </Muted>
          <View style={{ flexDirection: 'row', gap: t.space.x2, flexWrap: 'wrap' }}>
            {!a.isDefault && <Button label="Set default" variant="ghost" loading={busyId === a.id} onPress={() => setDefault(a.id)} />}
            <Button label="Delete" variant="danger" loading={busyId === a.id} onPress={() => remove(a)} />
          </View>
        </Card>
      ))}

      {adding
        ? <AddressForm firstOne={(addrs.data ?? []).length === 0} onDone={() => { setAdding(false); addrs.reload() }} onCancel={() => setAdding(false)} />
        : <Button label="Add an address" onPress={() => setAdding(true)} />}
    </ScrollView>
  )
}

function AddressForm({ firstOne, onDone, onCancel }: { firstOne: boolean; onDone: () => void; onCancel: () => void }) {
  const t = useTheme()
  const [label, setLabel] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [stateName, setStateName] = useState('')
  const [pincode, setPincode] = useState('')
  const [phone, setPhone] = useState('')
  const [isDefault, setIsDefault] = useState(firstOne)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!recipientName.trim()) { setError("Who is this addressed to?"); return }
    if (!line1.trim()) { setError('Add the street address.'); return }
    if (!city.trim()) { setError('Which city?'); return }
    if (pincode.replace(/\D/g, '').length !== 6) { setError('A pincode is 6 digits.'); return }
    setError(null); setBusy(true)
    try {
      await api.addAddress({
        label: label.trim() || null,
        recipientName: recipientName.trim(),
        line1: line1.trim(),
        line2: line2.trim() || null,
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.replace(/\D/g, ''),
        phone: phone.trim() || null,
        isDefault,
      })
      onDone()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Card style={{ gap: t.space.x3 }}>
      <SectionTitle>New address</SectionTitle>
      <Field label="Label (optional)" value={label} onChangeText={setLabel} placeholder="Home, Office…" />
      <Field label="Recipient name" value={recipientName} onChangeText={setRecipientName} />
      <Field label="Address line 1" value={line1} onChangeText={setLine1} placeholder="Flat / house no., street" />
      <Field label="Address line 2 (optional)" value={line2} onChangeText={setLine2} placeholder="Area, landmark" />
      <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
        <View style={{ flex: 1 }}><Field label="City" value={city} onChangeText={setCity} /></View>
        <View style={{ flex: 1 }}><Field label="State" value={stateName} onChangeText={setStateName} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
        <View style={{ flex: 1 }}><Field label="Pincode" value={pincode} onChangeText={setPincode} keyboardType="number-pad" /></View>
        <View style={{ flex: 1 }}><Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt style={{ color: t.colors.text }}>Make this my default</Txt>
        <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: t.colors.accent, false: t.colors.border }} thumbColor={t.colors.bgRaised} />
      </View>
      {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
      <Button label="Save address" loading={busy} onPress={save} />
      <Button label="Cancel" variant="ghost" onPress={onCancel} />
    </Card>
  )
}
