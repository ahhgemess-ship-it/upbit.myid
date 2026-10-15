import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { encryptFile, decryptFile } from './crypto.js'
import { sanitizeImageBuffer } from './imageUpload.js'

// Penyimpanan file dwi-mode:
// - PRODUKSI (Vercel): jika ada BLOB_READ_WRITE_TOKEN → simpan ke Vercel Blob.
// - LOKAL: simpan ke folder uploads/ di disk (seperti sebelumnya).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN

const randName = (prefix, originalname, fallbackExt = '.png') => {
  const ext = (path.extname(originalname || '') || fallbackExt).slice(0, 8).toLowerCase()
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`
}

// Simpan buffer. `folder` mis. 'products/' (publik) atau '' (bukti bayar).
// Mengembalikan REFERENSI yang disimpan di DB:
//  - Blob  → URL absolut (https://...)
//  - Disk  → untuk products: path publik '/uploads/products/<file>'; untuk proof: nama file
export async function saveUpload(buffer, { prefix, originalname, folder = '', contentType, sensitive = false }) {
  const storedBuffer = sensitive ? encryptFile(buffer, contentType) : buffer
  const storedType = sensitive ? 'application/octet-stream' : (contentType || 'application/octet-stream')
  const filename = randName(prefix, sensitive ? `${originalname || 'upload'}.bin` : originalname, sensitive ? '.bin' : '.png')
  if (USE_BLOB) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`${folder}${filename}`, storedBuffer, {
      access: 'public',
      contentType: storedType,
      addRandomSuffix: true,
      cacheControlMaxAge: sensitive ? 60 : 31_536_000,
    })
    return blob.url
  }
  const dir = path.join(UPLOAD_DIR, folder)
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, filename), storedBuffer)
  } catch (e) {
    // Serverless Vercel tidak punya disk persisten & Blob belum diset →
    // JANGAN gagalkan proses (order/upload):
    //  - produk kecil (<=100KB) → data-URL base64 (logo tetap tampil, tidak membengkakkan API)
    //  - bukti / produk besar    → referensi nama saja (admin lihat "bukti tidak tersedia")
    if (folder === 'products/' && storedBuffer.length <= 100 * 1024) {
      return `data:${storedType};base64,${storedBuffer.toString('base64')}`
    }
    console.warn('saveUpload: penyimpanan file gagal, simpan referensi saja:', e.message)
  }
  return folder === 'products/' ? `/uploads/products/${filename}` : filename
}

// Ambil isi file bukti bayar (untuk route admin). `ref` = URL Blob atau nama file lokal.
export async function readUpload(ref) {
  if (!ref) return null
  let raw
  let responseType = ''
  if (/^https?:\/\//.test(ref)) {
    const r = await fetch(ref)
    if (!r.ok) return null
    raw = Buffer.from(await r.arrayBuffer())
    responseType = r.headers.get('content-type') || ''
  } else {
    const fp = path.join(UPLOAD_DIR, ref)
    if (!fs.existsSync(fp)) return null
    raw = fs.readFileSync(fp)
  }

  const opened = decryptFile(raw)
  if (!opened.buffer) return null
  try {
    const safe = await sanitizeImageBuffer(opened.buffer, {
      declaredType: opened.contentType || (responseType.startsWith('image/') ? responseType : ''),
      requireDeclaredType: false,
    })
    return { buffer: safe.buffer, contentType: safe.contentType, extension: safe.extension }
  } catch {
    return null
  }
}
