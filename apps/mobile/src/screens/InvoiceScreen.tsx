import { createElement, useState } from 'react'
import { Platform, View } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import { api, useApi } from '@trueglaz/core'
import { useTheme } from '../theme/ThemeContext'
import { Button } from '../components/form'
import { ErrorNote, Loading, Muted } from '../components/ui'
import { notify } from '../components/Confirm'

/**
 * A buyer's tax invoice, in the app (TG-158).
 *
 * The API's printable copy is shown as it is (the same document the website
 * opens), with scripts off and links going nowhere. "Save or share PDF" turns
 * it into a PDF named after the invoice and opens the phone's share sheet:
 * Files, Drive, WhatsApp, mail — wherever a warranty claim or an expense
 * return needs it.
 */
export function InvoiceScreen({ route }: { route: any }) {
  const t = useTheme()
  const { invoiceId, invoiceNumber } = route.params as { invoiceId: string; invoiceNumber?: string | null }
  const doc = useApi(() => api.invoiceHtml(invoiceId), [invoiceId])
  const [busy, setBusy] = useState<'share' | 'print' | null>(null)

  const share = async () => {
    if (!doc.data) return
    setBusy('share')
    try {
      const { uri } = await Print.printToFileAsync({ html: doc.data })
      // printToFileAsync names the file at random; a buyer should see the invoice number.
      const out = new File(Paths.cache, `TrueGlaz-invoice-${(invoiceNumber ?? 'copy').replace(/[^\w-]/g, '-')}.pdf`)
      if (out.exists) out.delete()
      await new File(uri).move(out)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(out.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Invoice ${invoiceNumber ?? ''}`.trim() })
      } else {
        await Print.printAsync({ uri: out.uri })
      }
    } catch (e) {
      void notify('Could not make the PDF', (e as Error).message || 'Try again in a moment.')
    } finally { setBusy(null) }
  }

  const print = async () => {
    if (!doc.data) return
    setBusy('print')
    // The phone's print screen also offers "Save as PDF".
    try { await Print.printAsync({ html: doc.data }) } catch { /* closed without printing */ } finally { setBusy(null) }
  }

  if (doc.error) return <View style={{ flex: 1, backgroundColor: t.colors.bg, padding: t.space.x4 }}><ErrorNote error={doc.error} onRetry={doc.reload} /></View>
  if (!doc.data) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}><Loading /></View>

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {Platform.OS === 'web'
        // The browser build used for checks has no native WebView: a sandboxed frame shows the same document.
        ? createElement('iframe', { title: `Invoice ${invoiceNumber ?? ''}`, srcDoc: doc.data, sandbox: '', style: { flex: 1, border: 0, background: '#fff' } })
        : (
          <WebView
            source={{ html: doc.data }}
            originWhitelist={['about:*']}
            javaScriptEnabled={false}
            onShouldStartLoadWithRequest={(r) => r.url.startsWith('about:')}
            setSupportMultipleWindows={false}
            style={{ flex: 1, backgroundColor: '#fff' }}
          />
        )}
      <View style={{ padding: t.space.x4, gap: t.space.x2, borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.bgRaised }}>
        {Platform.OS === 'web'
          ? <Muted size={t.size.xs} style={{ textAlign: 'center' }}>Save or share the PDF from the app on your phone.</Muted>
          : (
            <>
              <Button label={busy === 'share' ? 'Making the PDF…' : 'Save or share PDF'} variant="cta" loading={busy === 'share'} disabled={!!busy} onPress={share} />
              <Button label="Print" variant="ghost" disabled={!!busy} onPress={print} />
            </>
          )}
      </View>
    </View>
  )
}
