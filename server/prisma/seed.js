import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
// Sumber data awal = katalog frontend (satu sumber). Setelah seed, DB jadi otoritatif.
import { products } from '../../app/src/data/products.js'

const prisma = new PrismaClient()

async function main() {
  // Katalog dipecah per tier — hapus produk lama agar id lama tidak menumpuk.
  const ids = products.map((p) => p.id)
  await prisma.product.deleteMany({ where: { id: { notIn: ids } } })

  // "Total terjual": angka acak UNIK 100–500. Nilai yang sudah ada DIPERTAHANKAN
  // (tidak ke-reset saat re-seed); hanya produk baru yang diberi angka baru.
  const existing = await prisma.product.findMany({ select: { id: true, sold: true } })
  const soldById = Object.fromEntries(existing.map((e) => [e.id, e.sold]))
  const used = new Set(Object.values(soldById).filter((s) => s >= 100 && s <= 500))
  const pool = []
  for (let n = 100; n <= 500; n++) if (!used.has(n)) pool.push(n)
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[pool[i], pool[j]] = [pool[j], pool[i]] }
  const nextSold = () => (pool.length ? pool.pop() : 100 + Math.floor(Math.random() * 401))

  for (const p of products) {
    // Pertahankan sold lama bila valid (100–500); kalau belum ada, ambil unik baru.
    const cur = soldById[p.id]
    const sold = cur >= 100 && cur <= 500 ? cur : nextSold()
    const data = {
      name: p.name,
      vendor: p.vendor,
      category: p.category,
      tagline: p.tagline || null,
      description: p.description || null,
      features: JSON.stringify(p.features || []),
      logo: p.logo || null,
      brand: p.brand || null,
      period: p.period || null,
      rating: p.rating ?? 5,
      price: p.price,
      priceIntl: p.priceIntl ?? 0,
      flashPrice: p.flashPrice ?? null,
      flashPriceIntl: p.flashPriceIntl ?? null,
      estimate: p.estimate || null,
      tiers: JSON.stringify(p.tiers || []),
    }
    // Jangan timpa stock/active/flashSale/diskon/sold yang sudah diatur (sold dipertahankan).
    // Produk BARU default masuk flash sale bila kategori 'Promo' (perilaku lama),
    // tapi admin bisa ubah via panel Flash Sale tanpa perlu ubah kategori.
    await prisma.product.upsert({
      where: { id: p.id },
      update: data, // data tidak memuat flashSale/stock/active/sold → nilai admin dipertahankan
      create: { id: p.id, stock: -1, active: true, sold, flashSale: p.category === 'Promo', ...data },
    })
  }
  // Kupon TIDAK di-seed — dibuat oleh admin lewat panel.
  console.log(`Seed selesai: ${products.length} produk. (Kupon dibuat manual oleh admin.)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
