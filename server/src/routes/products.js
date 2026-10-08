import { Router } from 'express'
import { prisma } from '../db.js'
import { effectiveDiscount } from '../discount.js'
import { USD_TO_IDR } from '../money.js'

const router = Router()

const parseJsonArray = (value) => {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Bentuk produk untuk klien. `discountPercent` = diskon EFEKTIF (sudah cek jadwal).
export function formatProduct(p, { admin = false } = {}) {
  const pct = effectiveDiscount(p)
  // USD flash turunan dari Rp bila kosong — cocok dengan perhitungan checkout
  // server, agar pembeli USD/CNY tidak kehilangan harga flash di kartu/detail.
  const flashUsd = p.flashSale && Number(p.flashPrice) > 0
    ? (Number(p.flashPriceIntl) > 0 ? p.flashPriceIntl : Math.max(1, Math.round((Number(p.flashPrice) * 100) / USD_TO_IDR)))
    : p.flashPriceIntl
  const tiers = parseJsonArray(p.tiers)
  // Beberapa produk lama tersimpan tanpa tier. Tetap kirim satu tier valid agar
  // kartu flash sale dan editor admin tidak crash saat stok diubah.
  const safeTiers = tiers.length
    ? tiers
    : [{ label: p.period || 'Produk', price: p.price, priceIntl: p.priceIntl || 0 }]
  return {
    id: p.id,
    name: p.name,
    vendor: p.vendor,
    category: p.category,
    tagline: p.tagline,
    description: p.description,
    features: parseJsonArray(p.features),
    logo: p.logo,
    brand: p.brand,
    badge: p.badge ?? null,
    badgeColor: p.badgeColor ?? null,
    period: p.period,
    rating: p.rating,
    sold: p.sold,
    price: p.price,
    priceIntl: p.priceIntl,
    estimate: p.estimate,
    tiers: safeTiers,
    stock: p.stock, // -1 = tak terbatas
    flashSale: p.flashSale,
    stockOut: p.stockOut,
    flashPrice: p.flashPrice,
    flashPriceIntl: flashUsd,
    discountPercent: pct,
    // Dipakai frontend (Home) untuk menampilkan produk terbaru/teredit dulu.
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...(admin
      ? {
          active: p.active,
          discountRaw: p.discountPercent,
          discountStart: p.discountStart,
          discountEnd: p.discountEnd,
        }
      : {}),
  }
}

// GET /api/products — katalog publik (hanya produk aktif)
router.get('/', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
  })
  res.json(products.map((p) => formatProduct(p)))
})

export default router
