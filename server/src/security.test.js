import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { encryptFile, decryptFile } from './crypto.js'
import { sanitizeImageBuffer, sanitizeUploadedImage } from './imageUpload.js'
import { publicReview } from './routes/reviews.js'

test('bukti SVG ditolak walau dikirim sebagai gambar', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
  await assert.rejects(
    () => sanitizeUploadedImage({ buffer: svg, mimetype: 'image/svg+xml' }),
    /JPG, PNG, atau WebP/,
  )
})

test('konten HTML yang menyamar sebagai PNG ditolak', async () => {
  const html = Buffer.from('<!doctype html><script>location="https://example.invalid"</script>')
  await assert.rejects(
    () => sanitizeUploadedImage({ buffer: html, mimetype: 'image/png' }),
    /Isi file bukan gambar/,
  )
})

test('gambar valid dikonversi ulang tanpa metadata aktif', async () => {
  const input = await sharp({
    create: { width: 16, height: 16, channels: 4, background: '#336699' },
  }).png().withMetadata({ comment: 'sensitive metadata' }).toBuffer()
  const safe = await sanitizeImageBuffer(input, { declaredType: 'image/png' })
  const metadata = await sharp(safe.buffer).metadata()
  assert.equal(safe.contentType, 'image/png')
  assert.equal(metadata.format, 'png')
  assert.equal(metadata.exif, undefined)
  assert.equal(metadata.xmp, undefined)
})

test('bukti pembayaran terenkripsi dan dapat dibuka kembali', () => {
  const source = Buffer.from('binary payment proof')
  const protectedFile = encryptFile(source, 'image/png')
  assert.notDeepEqual(protectedFile, source)
  const opened = decryptFile(protectedFile)
  assert.equal(opened.protected, true)
  assert.equal(opened.contentType, 'image/png')
  assert.deepEqual(opened.buffer, source)
})

test('ulasan publik tidak membuka nama, avatar, atau alamat email', () => {
  const review = publicReview({
    name: 'Alice Example',
    avatar: 'https://example.invalid/private-photo.jpg',
    rating: 5,
    comment: 'Hubungi alice@example.com',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  })
  assert.equal(review.name, 'A***')
  assert.equal(review.avatar, null)
  assert.equal(review.comment, 'Hubungi [email disembunyikan]')
})
