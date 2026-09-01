import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { effectiveDiscount } from '../discount.js'

const router = Router()

// Bentuk produk untuk klien. `discountPercent` = diskon EFEKTIF (sudah cek jadwal).
export function formatProduct(p, { admin = false } = {}) {
  const pct = effectiveDiscount(p)
  return {
    id: p.id,
    name: p.name,
    vendor: p.vendor,
    category: p.category,
    tagline: p.tagline,
    description: p.description,
    features: JSON.parse(p.features || '[]'),
    logo: p.logo,
    brand: p.brand,
    period: p.period,
    rating: p.rating,
    sold: p.sold,
    price: p.price,
    priceIntl: p.priceIntl,
    estimate: p.estimate,
    tiers: JSON.parse(p.tiers || '[]'),
    stock: p.stock, // -1 = tak terbatas
    flashSale: p.flashSale,
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
