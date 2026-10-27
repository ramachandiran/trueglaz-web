/**
 * Client-side encryption for the Gear Vault.
 *
 * The sensitive fields of a vault item (serial, what you paid, notes) are
 * encrypted on the device with a per-user key the server never holds, so even
 * TrueGlaz cannot read them. The model stays in the clear for valuation and
 * wishlist matching; the full data is revealed only when the owner chooses to
 * sell.
 *
 * The data key (DEK) encrypts the fields with AES-256-GCM. The DEK itself is
 * wrapped twice — once by a key derived from the user's Vault PIN, once by a
 * key derived from a one-time recovery code — and only those wrapped blobs
 * leave the device. A wrong PIN fails the GCM tag, so there is no separate
 * verifier to leak. All of this is isomorphic: the same code runs on web and
 * in React Native (which needs the getRandomValues polyfill loaded first).
 */
import { gcm } from '@noble/ciphers/aes'
import { scrypt } from '@noble/hashes/scrypt'
import { randomBytes, bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'

const SCRYPT = { N: 32768, r: 8, p: 1, dkLen: 32 }
const KDF_ID = 'scrypt-32768-8-1'

/** What the server stores for a user's vault key — all opaque to it. */
export interface VaultKeyBlobs {
  kdf: string
  salt: string
  wrappedDekPin: string
  wrappedDekRecovery: string
}

function sealBytes(key: Uint8Array, data: Uint8Array): string {
  const nonce = randomBytes(12)
  const ct = gcm(key, nonce).encrypt(data)
  return `v1:${bytesToHex(nonce)}:${bytesToHex(ct)}`
}

function openBytes(key: Uint8Array, blob: string): Uint8Array {
  const parts = blob.split(':')
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('Unrecognised encrypted value')
  return gcm(key, hexToBytes(parts[1])).decrypt(hexToBytes(parts[2]))
}

/** Portable UTF-8 decode (avoids relying on TextDecoder in React Native). */
function bytesToStr(b: Uint8Array): string {
  let s = '', i = 0
  while (i < b.length) {
    const c = b[i++]
    if (c < 0x80) s += String.fromCharCode(c)
    else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (b[i++] & 0x3f))
    else if (c < 0xf0) s += String.fromCharCode(((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f))
    else {
      const cp = ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f)
      const u = cp - 0x10000
      s += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff))
    }
  }
  return s
}

/** scrypt KEK from a secret (PIN or recovery code) and the stored salt. */
function deriveKey(secret: string, salt: Uint8Array): Uint8Array {
  return scrypt(utf8ToBytes(secret.normalize('NFKC')), salt, SCRYPT)
}

/** A readable one-time recovery code, e.g. ABCD-EF12-… (Crockford base32). */
function newRecoveryCode(): string {
  const bytes = randomBytes(20)
  const alpha = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  let bits = 0, value = 0, out = ''
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8
    while (bits >= 5) { out += alpha[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  return (out.match(/.{1,4}/g) ?? [out]).join('-')
}

function wrap(dek: Uint8Array, pin: string, recoveryCode: string): VaultKeyBlobs {
  const salt = randomBytes(16)
  return {
    kdf: KDF_ID,
    salt: bytesToHex(salt),
    wrappedDekPin: sealBytes(deriveKey(pin, salt), dek),
    wrappedDekRecovery: sealBytes(deriveKey(recoveryCode, salt), dek),
  }
}

/** Mint a new vault key. The recovery code is returned once and never stored. */
export function createVaultKey(pin: string): { blobs: VaultKeyBlobs; recoveryCode: string; dek: Uint8Array } {
  const dek = randomBytes(32)
  const recoveryCode = newRecoveryCode()
  return { dek, recoveryCode, blobs: wrap(dek, pin, recoveryCode) }
}

/** Unlock the DEK with the PIN. Throws if the PIN is wrong. */
export function unlockWithPin(pin: string, blobs: VaultKeyBlobs): Uint8Array {
  return openBytes(deriveKey(pin, hexToBytes(blobs.salt)), blobs.wrappedDekPin)
}

/** Unlock the DEK with the recovery code. Throws if the code is wrong. */
export function unlockWithRecovery(code: string, blobs: VaultKeyBlobs): Uint8Array {
  return openBytes(deriveKey(code.trim().toUpperCase(), hexToBytes(blobs.salt)), blobs.wrappedDekRecovery)
}

/** Re-wrap an unlocked DEK under a new PIN, issuing a fresh recovery code. */
export function rewrapWithNewPin(dek: Uint8Array, newPin: string): { blobs: VaultKeyBlobs; recoveryCode: string } {
  const recoveryCode = newRecoveryCode()
  return { blobs: wrap(dek, newPin, recoveryCode), recoveryCode }
}

export function encryptField(dek: Uint8Array, plaintext: string): string {
  return sealBytes(dek, utf8ToBytes(plaintext))
}

export function decryptField(dek: Uint8Array, blob: string): string {
  return bytesToStr(openBytes(dek, blob))
}
