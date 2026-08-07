import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

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
export async function saveUpload(buffer, { prefix, originalname, folder = '', contentType, public: pub = true }) {
  const filename = randName(prefix, originalname)
  if (USE_BLOB) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`${folder}${filename}`, buffer, {
      access: 'public', // Vercel Blob: URL acak tak-tertebak (proof tetap diakses lewat route admin)
      contentType: contentType || 'application/octet-stream',
      addRandomSuffix: true,
    })
    return blob.url
  }
  const dir = path.join(UPLOAD_DIR, folder)
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, filename), buffer)
  } catch (e) {
    // Serverless Vercel tidak punya disk persisten & Blob belum diset →
    // JANGAN gagalkan proses (order/upload):
    //  - produk kecil (<=100KB) → data-URL base64 (logo tetap tampil, tidak membengkakkan API)
    //  - bukti / produk besar    → referensi nama saja (admin lihat "bukti tidak tersedia")
    if (folder === 'products/' && buffer.length <= 100 * 1024) {
      return `data:${contentType || 'image/png'};base64,${buffer.toString('base64')}`
    }
    console.warn('saveUpload: penyimpanan file gagal, simpan referensi saja:', e.message)
  }
  return folder === 'products/' ? `/uploads/products/${filename}` : filename
}

// Ambil isi file bukti bayar (untuk route admin). `ref` = URL Blob atau nama file lokal.
export async function readUpload(ref) {
  if (!ref) return null
  if (/^https?:\/\//.test(ref)) {
    const r = await fetch(ref)
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    return { buffer: buf, contentType: r.headers.get('content-type') || 'application/octet-stream' }
  }
  const fp = path.join(UPLOAD_DIR, ref)
  if (!fs.existsSync(fp)) return null
  return { buffer: fs.readFileSync(fp), contentType: 'image/*' }
}
