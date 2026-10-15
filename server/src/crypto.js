import crypto from 'node:crypto'

// Enkripsi data sensitif at-rest (AES-256-GCM).
// Format tersimpan: "enc:v1:" + base64(iv[12] | authTag[16] | ciphertext)

const ALGO = 'aes-256-gcm'
const PREFIX = 'enc:v1:'
const FILE_MAGIC = Buffer.from('UPB1')

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

export function encryptFile(buffer, contentType) {
  const mime = Buffer.from(contentType || 'application/octet-stream', 'utf8')
  if (mime.length > 255) throw new Error('Content-Type file terlalu panjang')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, KEY, iv)
  const ct = Buffer.concat([cipher.update(buffer), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([FILE_MAGIC, Buffer.from([mime.length]), mime, iv, tag, ct])
}

export function decryptFile(blob) {
  if (!Buffer.isBuffer(blob) || !blob.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) {
    return { protected: false, buffer: blob, contentType: null }
  }
  try {
    const mimeLength = blob[FILE_MAGIC.length]
    const mimeStart = FILE_MAGIC.length + 1
    const ivStart = mimeStart + mimeLength
    const tagStart = ivStart + 12
    const ctStart = tagStart + 16
    if (!mimeLength || blob.length <= ctStart) throw new Error('Envelope file tidak valid')
    const contentType = blob.subarray(mimeStart, ivStart).toString('utf8')
    const decipher = crypto.createDecipheriv(ALGO, KEY, blob.subarray(ivStart, tagStart))
    decipher.setAuthTag(blob.subarray(tagStart, ctStart))
    const buffer = Buffer.concat([decipher.update(blob.subarray(ctStart)), decipher.final()])
    return { protected: true, buffer, contentType }
  } catch {
    return { protected: true, buffer: null, contentType: null }
  }
}
