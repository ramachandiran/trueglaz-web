import { useEffect, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { api, money, useApi, type Address, type Reservation } from '@trueglaz/core'
import { Txt } from '../components/Txt'
import { useTheme } from '../theme/ThemeContext'
import { Button, Field } from '../components/form'
import { Card, ErrorNote, Loading, Muted, SectionTitle } from '../components/ui'
import { ModelThumb, useModelImages } from '../components/ModelImage'

const PINCODE = /^[1-9][0-9]{5}$/

export function CheckoutScreen({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme()
  const { listingId, title, priceMinor, currency } = route.params as {
    listingId: string; title: string; priceMinor: number; currency: string
  }

  const meta = useApi(() => api.meta(), [])
  // Only for the model picture; the price and title travel in the route params.
  const listing = useApi(() => api.listing(listingId), [listingId])
  const pictures = useModelImages()
  const addresses = useApi(() => api.myAddresses(), [])

  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [reserveError, setReserveError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // No saved address: the form is the only way forward, so it starts open (TG-15).
  useEffect(() => { if (addresses.data && addresses.data.length === 0) setAdding(true) }, [addresses.data])
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [recipientName, setRecipientName] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [stateName, setStateName] = useState('')
  const [pincode, setPincode] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    let released = false
    let held: Reservation | null = null
    api.reserve(listingId)
      .then((r) => { held = r; if (!released) setReservation(r) })
      .catch((e) => setReserveError((e as Error).message))
    return () => {
      released = true
      if (held && !held.orderId) { api.releaseReservation(held.id).catch(() => {}) }
    }
  }, [listingId])

  useEffect(() => {
    if (selectedId || !addresses.data?.length) return
    setSelectedId((addresses.data.find((a) => a.isDefault) ?? addresses.data[0]).id)
  }, [addresses.data, selectedId])

  const buildAddress = (): Record<string, unknown> | null => {
    if (!adding && selectedId) {
      const a = addresses.data?.find((x) => x.id === selectedId)
      if (!a) return null
      return {
        recipientName: a.recipientName, line1: a.line1, line2: a.line2 ?? undefined,
        city: a.city, state: a.state, pincode: a.pincode, phone: a.phoneE164 ?? undefined,
      }
    }
    if (!recipientName.trim() || !line1.trim() || !city.trim()) { setError('Name, street and city are required.'); return null }
    if (!PINCODE.test(pincode.trim())) { setError('That pincode does not look right.'); return null }
    return {
      recipientName: recipientName.trim(), line1: line1.trim(), line2: line2.trim() || undefined,
      city: city.trim(), state: stateName.trim() || undefined, pincode: pincode.trim(), phone: phone.trim() || undefined,
    }
  }

  const placeOrder = async () => {
    if (!reservation) return
    const address = buildAddress()
    if (!address) return
    setError(null); setPlacing(true)
    try {
      if (adding) {
        await api.addAddress({
          recipientName: recipientName.trim(), line1: line1.trim(), line2: line2.trim() || null,
          city: city.trim(), state: stateName.trim() || undefined, pincode: pincode.trim(),
          phone: phone.trim() || null, isDefault: !addresses.data?.length,
        }).catch(() => {})
      }
      const order = await api.checkout(reservation.id, address)
      if (meta.data?.paymentGateway === 'stub') {
        await api.stubPay(order.id, 'approve')
        navigation.replace('OrderDetail', { id: order.id, justPaid: true })
      } else {
        // A real gateway: open its checkout. The order is placed; paying is the next step.
        navigation.replace('Pay', { orderId: order.id })
      }
    } catch (e) { setError((e as Error).message) } finally { setPlacing(false) }
  }

  if (reserveError) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4, gap: t.space.x3 }}>
        <ErrorNote error={new Error(reserveError)} />
        {/checking this item out|already been sold/i.test(reserveError) && (
          <Muted>Someone may be buying this right now, or it has sold. Try another listing.</Muted>
        )}
        <Button label="Back to shop" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    )
  }
  if (!reservation || meta.loading || addresses.loading) {
    return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: t.space.x4, gap: t.space.x4, paddingBottom: t.space.x7 }}>
        <Card style={{ gap: t.space.x2 }}>
          <SectionTitle>Your item</SectionTitle>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.x3 }}>
            <ModelThumb image={pictures.bySlug(listing.data?.modelSlug)} size={64} want={400} />
            <Txt style={{ flex: 1, color: t.colors.text, fontWeight: t.weight.medium as never }}>{title}</Txt>
          </View>
          <Txt style={{ color: t.colors.text, fontSize: t.size.lg, fontWeight: t.weight.bold as never }}>{money(priceMinor, currency)}</Txt>
          {meta.data && meta.data.shippingMinor > 0 && <Muted size={t.size.xs}>+ {money(meta.data.shippingMinor)} delivery</Muted>}
          <Muted size={t.size.xs}>Held for you while you check out.</Muted>
        </Card>

        <Card style={{ gap: t.space.x3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionTitle>Deliver to</SectionTitle>
            {(addresses.data?.length ?? 0) > 0 && (
              <Pressable onPress={() => setAdding((v) => !v)}>
                <Txt style={{ color: t.colors.accent }}>{adding ? 'Pick saved' : '+ New address'}</Txt>
              </Pressable>
            )}
          </View>

          {!adding && (addresses.data ?? []).map((a) => (
            <AddressRow key={a.id} a={a} selected={selectedId === a.id} onPress={() => setSelectedId(a.id)} />
          ))}
          {!adding && !addresses.data?.length && <Muted>No saved addresses — add one.</Muted>}

          {adding && (
            <View style={{ gap: t.space.x3 }}>
              <Field label="Recipient name" value={recipientName} onChangeText={setRecipientName} />
              <Field label="Street address" value={line1} onChangeText={setLine1} />
              <Field label="Apartment, suite (optional)" value={line2} onChangeText={setLine2} />
              <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
                <View style={{ flex: 1 }}><Field label="City" value={city} onChangeText={setCity} /></View>
                <View style={{ flex: 1 }}><Field label="State" value={stateName} onChangeText={setStateName} /></View>
              </View>
              <View style={{ flexDirection: 'row', gap: t.space.x2 }}>
                <View style={{ flex: 1 }}><Field label="Pincode" value={pincode} onChangeText={setPincode} keyboardType="number-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></View>
              </View>
            </View>
          )}
        </Card>

        {error && <Txt style={{ color: t.colors.bad, fontSize: t.size.sm }}>{error}</Txt>}
        {meta.data?.paymentsAreReal === false && (
          <Muted size={t.size.xs}>Demo gateway — no real money moves. Payment is approved instantly.</Muted>
        )}
      </ScrollView>

      <View style={{ padding: t.space.x4, borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.bgRaised }}>
        <Button
          label={placing ? 'Placing…' : `Pay ${money(priceMinor + (meta.data?.shippingMinor ?? 0), currency)}`}
          variant="cta" loading={placing} onPress={placeOrder}
        />
      </View>
    </View>
  )
}

function AddressRow({ a, selected, onPress }: { a: Address; selected: boolean; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable onPress={onPress}
      style={{ borderWidth: 1, borderRadius: t.radius.md, padding: t.space.x3, gap: 2, borderColor: selected ? t.colors.accent : t.colors.border, backgroundColor: selected ? t.colors.accentSoft : t.colors.bg }}>
      <Txt style={{ color: t.colors.text, fontWeight: t.weight.medium as never }}>{a.recipientName}{a.isDefault ? '  · default' : ''}</Txt>
      <Muted size={t.size.xs}>{[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}</Muted>
    </Pressable>
  )
}
