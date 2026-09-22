// MIGRASI ONE-OFF: gabungkan baris produk per-durasi (hasil split lama,
// mis. `claude-pro-1-bulan` + `claude-pro-1-tahun`) menjadi SATU baris keluarga
// (`claude-pro`) dengan tiers JSON lengkap — pilihan durasi lewat dropdown di UI.
//
// Aman & idempoten:
//   - Harga per durasi hasil edit admin DIPERTAHANKAN (diambil dari tiap baris).
//   - Baris per-durasi lama TIDAK dihapus, hanya `active: false` (riwayat pesanan
//     lama yang menyimpan id lama tetap sah — OrderItem memakai snapshot).
//   - UserProductStock (tanda "sudah dibeli") dipindah ke id keluarga.
//
// Jalankan: cd server && DATABASE_URL=... node prisma/merge-durations.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const slug = (s) => (s || '').toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Definisi keluarga multi-durasi — harus sama dengan FAMILIES di app/src/data/products.js
const FAMILIES = [
  { id: 'claude-pro', tiers: ['1 Bulan', '1 Tahun'] },
  { id: 'claude-max-5x', tiers: ['1 Bulan', '1 Tahun'] },
  { id: 'claude-max-20x', tiers: ['1 Bulan', '1 Tahun'] },
  { id: 'google-ai-pro', tiers: ['12 Bulan', '18 Bulan'] },
  { id: 'google-ai-ultra', tiers: ['1 Bulan', '1 Tahun'] },
  { id: 'chatgpt-plus', tiers: ['1 Bulan', '1 Tahun'] },
  { id: 'kiro-ai', tiers: ['Pro — 1.000 kredit', 'Pro+ — 2.000 kredit', 'Power — 10.000 kredit'] },
  { id: 'cursor', tiers: ['Pro', 'Pro+', 'Ultra'] },
  { id: 'qoder', tiers: ['Pro', 'Pro+', 'Ultra'] },
  { id: 'leonardo-ai-pro', tiers: ['Artisan — 1 Bulan', 'Artisan — Tahunan', 'Maestro — 1 Bulan'] },
]

const all = await prisma.product.findMany()
const byId = Object.fromEntries(all.map((p) => [p.id, p]))

for (const fam of FAMILIES) {
  const splitIds = fam.tiers.map((l) => `${fam.id}-${slug(l)}`)
  const rows = [byId[fam.id], ...splitIds.map((id) => byId[id])].filter(Boolean)
  if (!rows.length) { console.log('SKIP (tidak ada baris):', fam.id); continue }

  // Susun tiers dari baris per-durasi — label & note dari JSON tiers lama,
  // harga dari kolom top-level (hasil edit admin terbaru).
  const tiers = []
  for (let i = 0; i < fam.tiers.length; i++) {
    const label = fam.tiers[i]
    const row = byId[i === 0 && byId[fam.id] ? fam.id : `${fam.id}-${slug(label)}`]
    if (!row) continue
    let extra = {}
    try { const arr = JSON.parse(row.tiers || '[]'); if (Array.isArray(arr) && arr[0]) extra = arr[0] } catch { /* ignore */ }
    tiers.push({ ...extra, label: extra.label || label, price: row.price, priceIntl: row.priceIntl })
  }
  if (!tiers.length) { console.log('SKIP (tier kosong):', fam.id); continue }

  const baseRow = byId[fam.id] || byId[`${fam.id}-${slug(fam.tiers[0])}`]
  const limited = rows.map((r) => r.stock).filter((s) => Number.isFinite(s) && s >= 0)
  const stock = limited.length ? Math.min(...limited) : -1
  const data = {
    name: baseRow.name,
    vendor: baseRow.vendor,
    category: baseRow.category,
    tagline: baseRow.tagline,
    description: baseRow.description,
    features: baseRow.features,
    logo: baseRow.logo,
    brand: baseRow.brand,
    badge: baseRow.badge,
    badgeColor: baseRow.badgeColor,
    period: baseRow.period,
    rating: baseRow.rating,
    sold: rows.reduce((s, r) => s + (r.sold || 0), 0),
    price: tiers[0].price,
    priceIntl: tiers[0].priceIntl,
    estimate: baseRow.estimate,
    tiers: JSON.stringify(tiers),
    stock,
    active: true,
    flashSale: rows.some((r) => r.flashSale),
    stockOut: rows.some((r) => r.stockOut),
    flashPrice: baseRow.flashPrice,
    flashPriceIntl: baseRow.flashPriceIntl,
    discountPercent: baseRow.discountPercent,
    discountStart: baseRow.discountStart,
    discountEnd: baseRow.discountEnd,
  }
  await prisma.product.upsert({ where: { id: fam.id }, create: { id: fam.id, ...data }, update: data })

  // Nonaktifkan baris per-durasi (tetap tersimpan untuk riwayat pesanan lama)
  for (const r of rows) {
    if (r.id !== fam.id && r.active) await prisma.product.update({ where: { id: r.id }, data: { active: false } })
  }

  // Pindahkan tanda "sudah dibeli / stok habis per user" ke id keluarga
  const oldMarks = await prisma.userProductStock.findMany({ where: { productId: { in: splitIds } } })
  for (const m of oldMarks) {
    await prisma.userProductStock.upsert({
      where: { userId_productId: { userId: m.userId, productId: fam.id } },
      create: { userId: m.userId, productId: fam.id },
      update: {},
    })
  }
  if (oldMarks.length) {
    await prisma.userProductStock.deleteMany({ where: { productId: { in: splitIds } } })
  }

  console.log(`MERGE: ${fam.id} ← [${rows.map((r) => r.id).join(', ')}] tiers: ${tiers.map((t) => `${t.label}=Rp${t.price.toLocaleString('id-ID')}`).join(', ')}${oldMarks.length ? ` | marks moved: ${oldMarks.length}` : ''}`)
}

console.log('SELESAI.')
await prisma.$disconnect()
