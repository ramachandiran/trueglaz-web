import {
  api, createVaultKey, unlockWithPin, unlockWithRecovery, rewrapWithNewPin,
  encryptField, decryptField, type VaultKeyBlobsStored, type VaultItem, type MigratedItem,
} from '@trueglaz/core'

/**
 * The vault's optional "extra privacy" (PIN / zero-knowledge) mode.
 *
 * When on, the sensitive fields are encrypted with a key derived from the
 * user's PIN — the server stores only wrapped blobs and cannot read them. The
 * unlocked data key lives only in memory for this tab, so closing it re-locks
 * the vault. A recovery code is the only way back if the PIN is lost.
 */
let dek: Uint8Array | null = null
let blobs: VaultKeyBlobsStored | null = null
let e2eeOn = false
let loaded = false

export function isE2eeOn(): boolean { return e2eeOn }
export function isUnlocked(): boolean { return dek != null }
export function lockVault() { dek = null }

/** Refresh whether the vault is PIN-protected (and cache the wrapped blobs). */
export async function refreshVaultKey(): Promise<void> {
  blobs = await api.vaultKey()
  e2eeOn = blobs != null
  loaded = true
}
export async function ensureLoaded(): Promise<void> { if (!loaded) await refreshVaultKey() }

/** Turn on the PIN: re-encrypt existing items and store the wrapped key. */
export async function enableE2ee(pin: string, currentItems: VaultItem[]): Promise<string> {
  const made = createVaultKey(pin)
  const migrated: MigratedItem[] = currentItems
    .filter((it) => it.serial || it.costMinor != null || it.notes)
    .map((it) => ({
      id: it.id,
      serialCipher: it.serial ? encryptField(made.dek, it.serial) : null,
      costCipher: it.costMinor != null ? encryptField(made.dek, String(it.costMinor)) : null,
      notesCipher: it.notes ? encryptField(made.dek, it.notes) : null,
    }))
  await api.activateVaultE2ee(made.blobs, migrated)
  dek = made.dek; blobs = made.blobs; e2eeOn = true
  return made.recoveryCode
}

export async function unlockVault(pin: string): Promise<void> {
  await ensureLoaded()
  if (!blobs) throw new Error('This vault has no PIN')
  dek = unlockWithPin(pin, blobs)
}

/** Change the PIN while unlocked; returns a fresh recovery code. */
export async function changePin(newPin: string): Promise<string> {
  if (!dek) throw new Error('Unlock the vault first')
  const rewrapped = rewrapWithNewPin(dek, newPin)
  await api.setVaultKey(rewrapped.blobs)
  blobs = rewrapped.blobs
  return rewrapped.recoveryCode
}

/** Recover with the one-time code and set a new PIN; returns a fresh recovery code. */
export async function recoverVault(code: string, newPin: string): Promise<string> {
  await ensureLoaded()
  if (!blobs) throw new Error('This vault has no PIN')
  const recovered = unlockWithRecovery(code, blobs)
  const rewrapped = rewrapWithNewPin(recovered, newPin)
  await api.setVaultKey(rewrapped.blobs)
  dek = recovered; blobs = rewrapped.blobs
  return rewrapped.recoveryCode
}

/** Turn the PIN off (clears unreadable encrypted fields; the full-reset path). */
export async function disableE2ee(): Promise<void> {
  await api.disableVaultE2ee()
  dek = null; blobs = null; e2eeOn = false
}

export function encField(plaintext: string): string {
  if (!dek) throw new Error('The vault is locked')
  return encryptField(dek, plaintext)
}
export function decField(blob: string): string {
  if (!dek) throw new Error('The vault is locked')
  return decryptField(dek, blob)
}
