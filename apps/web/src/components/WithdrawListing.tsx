import { useState } from 'react'
import { api, ApiError } from '@trueglaz/core'

/**
 * The seller's way out while their item is simply on sale.
 *
 * Deliberately two steps: taking an item off sale sends it home, and there is no
 * button that puts it back. Once a buyer has started checking out, or bought it,
 * the API refuses and says so.
 */
export function WithdrawListing({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true); setError(null)
    try {
      await api.withdrawItem(itemId, note)
      onDone()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not go through')
    } finally { setBusy(false) }
  }

  if (!asking) {
    return (
      <p className="tg-muted" style={{ marginTop: 12 }}>
        Changed your mind?{' '}
        <button className="tg-button" onClick={() => setAsking(true)}>Take it off sale</button>
      </p>
    )
  }
  return (
    <div style={{ marginTop: 12 }}>
      <p>We will stop selling it and send it back to you. This cannot be undone.</p>
      <label className="tg-label">
        Anything we should know? <span className="tg-muted">(optional)</span>
        <textarea className="tg-input" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p role="alert" className="tg-error">{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="tg-button tg-button--primary" disabled={busy} onClick={go}>
          {busy ? 'Working…' : 'Yes, take it off sale'}
        </button>
        <button className="tg-button" disabled={busy} onClick={() => setAsking(false)}>Keep it listed</button>
      </div>
    </div>
  )
}
