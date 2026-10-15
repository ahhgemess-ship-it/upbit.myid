import sharp from 'sharp'

const MIME_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

const EXT_BY_FORMAT = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
}

export const SAFE_IMAGE_MIMES = new Set(Object.values(MIME_BY_FORMAT))

function signatureFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
  return null
}

export async function sanitizeImageBuffer(buffer, { declaredType = '', maxPixels = 24_000_000, requireDeclaredType = true } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('File gambar kosong atau tidak valid')
  if (requireDeclaredType && !SAFE_IMAGE_MIMES.has(declaredType)) {
    throw new Error('Format gambar harus JPG, PNG, atau WebP')
  }

  const format = signatureFormat(buffer)
  if (!format || !MIME_BY_FORMAT[format]) throw new Error('Isi file bukan gambar JPG, PNG, atau WebP yang valid')
  if (declaredType && declaredType !== MIME_BY_FORMAT[format]) throw new Error('Format dan isi file gambar tidak cocok')

  const source = sharp(buffer, { failOn: 'warning', limitInputPixels: maxPixels, sequentialRead: true })
  const metadata = await source.metadata()
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxPixels) {
    throw new Error('Resolusi gambar terlalu besar')
  }
  if ((metadata.pages || 1) > 1) throw new Error('Gambar animasi tidak didukung')

  let pipeline = source.rotate().resize({
    width: 4096,
    height: 4096,
    fit: 'inside',
    withoutEnlargement: true,
  })

  if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true })
  if (format === 'png') pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
  if (format === 'webp') pipeline = pipeline.webp({ quality: 90, effort: 4 })

  return {
    buffer: await pipeline.toBuffer(),
    contentType: MIME_BY_FORMAT[format],
    extension: EXT_BY_FORMAT[format],
  }
}

export async function sanitizeUploadedImage(file, options) {
  if (!file?.buffer) throw new Error('File gambar wajib diunggah')
  const safe = await sanitizeImageBuffer(file.buffer, { ...options, declaredType: file.mimetype })
  return {
    ...safe,
    originalname: `image${safe.extension}`,
  }
}
