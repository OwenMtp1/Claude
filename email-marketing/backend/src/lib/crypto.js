import crypto from 'node:crypto'
import { env } from '../config/env.js'

// Chiffrement symétrique des tokens OAuth au repos (AES-256-GCM).
// Format stocké : base64( iv(12) | authTag(16) | ciphertext ).
const ALGO = 'aes-256-gcm'

function getKey() {
  const hex = env.tokenEncryptionKey || ''
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY doit faire 32 octets (64 caractères hex). Générer : openssl rand -hex 32')
  }
  return key
}

export function encrypt(plain) {
  if (plain == null) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decrypt(blob) {
  if (blob == null) return null
  const buf = Buffer.from(blob, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
