import crypto from 'node:crypto'

// Enkripsi data sensitif at-rest (AES-256-GCM).
// Format tersimpan: "enc:v1:" + base64(iv[12] | authTag[16] | ciphertext)

const ALGO = 'aes-256-gcm'
const PREFIX = 'enc:v1:'

function getKey() {
  const hex = process.env.ENCRYPTION_KEY
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex')
  // Di produksi WAJIB ada ENCRYPTION_KEY/JWT_SECRET — jangan pakai kunci publik.
  const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
  if (IS_PROD && !process.env.JWT_SECRET) {
    throw new Error('ENCRYPTION_KEY (atau minimal JWT_SECRET) wajib diset di produksi.')
  }
  // fallback dev: turunkan kunci dari JWT_SECRET.
  return crypto.scryptSync(process.env.JWT_SECRET || 'dev-secret', 'upbit-enc-salt', 32)
}
const KEY = getKey()

export function encrypt(text) {
  if (text == null || text === '') return text
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, KEY, iv)
  const ct = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decrypt(blob) {
  if (blob == null || blob === '') return blob
  // data lama (plaintext) tidak berprefiks → kembalikan apa adanya
  if (typeof blob !== 'string' || !blob.startsWith(PREFIX)) return blob
  try {
    const raw = Buffer.from(blob.slice(PREFIX.length), 'base64')
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const ct = raw.subarray(28)
    const d = crypto.createDecipheriv(ALGO, KEY, iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8')
  } catch {
    return null
  }
}
