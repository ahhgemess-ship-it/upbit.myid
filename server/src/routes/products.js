import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { effectiveDiscount } from '../discount.js'

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
    flashPriceIntl: p.flashPriceIntl,
    discountPercent: pct,
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

// GET /api/products/purchased — produk yang sudah dibeli/stok habis per user
router.get('/purchased', requireAuth, async (req, res) => {
  const rows = await prisma.userProductStock.findMany({
    where: { userId: req.user.id },
    select: { productId: true },
  })
  res.json({ ids: rows.map((r) => r.productId) })
})

export default router
