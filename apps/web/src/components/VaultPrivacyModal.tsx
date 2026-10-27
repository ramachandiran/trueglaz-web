import { useState } from 'react'
import { ApiError, type VaultItem } from '@trueglaz/core'
import { enableE2ee, unlockVault, changePin, recoverVault, disableE2ee } from '../state/vaultKey'
import '../pages/VaultPage.css'

export type PrivacyMode = 'setup' | 'unlock' | 'change' | 'recover' | 'disable'

/**
 * Manages the vault's optional PIN: turn it on, unlock, change it, recover with
 * the one-time code, or reset it off. The PIN and recovery code never leave the
 * device — only the wrapped key does, and TrueGlaz can't reset either for you.
 */
export function VaultPrivacyModal({ mode, items, onDone, onClose }: {
  mode: PrivacyMode; items?: VaultItem[]; onDone: () => void; onClose: () => void
}) {
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<string | null>(null)

  const needsNewPin = mode === 'setup' || mode === 'change' || mode === 'recover'
  const pinOk = /^\d{4,}$/.test(pin)

  async function run() {
    setBusy(true); setErr(null)
    try {
      if (needsNewPin && pin !== pin2) throw new Error('PINs do not match')
      if (mode === 'setup') { setRecovery(await enableE2ee(pin, items ?? [])); return }
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

  const title = {
    setup: 'Turn on extra privacy', unlock: 'Unlock your vault', change: 'Change your PIN',
    recover: 'Recover your vault', disable: 'Turn off extra privacy',
  }[mode]

  return (
    <div className="vault__overlay" onClick={onClose}>
      <div className="vault__modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="vault__modal-head"><h2>{title}</h2><button className="vault__x" aria-label="Close" onClick={onClose}>×</button></div>

        {recovery ? (
          <>
            <p className="vault__hint">Save this recovery code somewhere safe. It is the <strong>only</strong> way back if you forget your PIN — we can’t reset it for you.</p>
            <div className="vault__recovery">{recovery}</div>
            <div className="vault__modal-actions"><button className="tg-button tg-button--primary" onClick={onDone}>I’ve saved it</button></div>
          </>
        ) : mode === 'disable' ? (
          <>
            <p className="vault__hint">This clears the encrypted details (serial, price, notes) you can no longer read, and returns the vault to standard encryption. Your items, values and warranties are kept. Use this only if you’ve lost both your PIN and recovery code.</p>
            {err && <p className="ops__error" role="alert">{err}</p>}
            <div className="vault__modal-actions">
              <button className="tg-button" onClick={onClose}>Cancel</button>
              <button className="tg-button tg-button--primary" disabled={busy} onClick={run}>{busy ? 'Working…' : 'Reset &amp; turn off'}</button>
            </div>
          </>
        ) : (
          <>
            {mode === 'setup' && <p className="vault__hint">Your serial numbers, prices and notes will be encrypted with a PIN only you know — not even TrueGlaz can read them. You’ll need it to view those details.</p>}
            {mode === 'recover' && (
              <label className="vault__field"><span>Recovery code</span>
                <input className="tg-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-EF12-…" autoFocus />
              </label>
            )}
            <label className="vault__field"><span>{mode === 'unlock' ? 'Vault PIN' : 'New Vault PIN (4+ digits)'}</span>
              <input className="tg-input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus={mode === 'unlock'} />
            </label>
            {needsNewPin && (
              <label className="vault__field"><span>Confirm PIN</span>
                <input className="tg-input" type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value)} />
              </label>
            )}
            {err && <p className="ops__error" role="alert">{err}</p>}
            <div className="vault__modal-actions">
              <button className="tg-button" onClick={onClose}>Cancel</button>
              <button className="tg-button tg-button--primary" disabled={busy || (mode === 'unlock' ? pin.length < 4 : !pinOk) || (mode === 'recover' && !code.trim())} onClick={run}>
                {busy ? 'Working…' : mode === 'unlock' ? 'Unlock' : mode === 'recover' ? 'Recover' : mode === 'change' ? 'Change PIN' : 'Turn on'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
