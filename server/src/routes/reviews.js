import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

// GET /api/reviews/:productId — daftar ulasan + ringkasan
router.get('/:productId', async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { productId: req.params.productId },
    orderBy: { createdAt: 'desc' },
  })
  const count = reviews.length
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0
  res.json({
    count,
    average: Math.round(avg * 10) / 10,
    reviews: reviews.map((r) => ({ name: r.name, avatar: r.avatar, rating: r.rating, comment: r.comment, date: r.createdAt })),
  })
})

// GET /api/reviews/:productId/eligibility — apakah user boleh review (sudah beli & belum review)
router.get('/:productId/eligibility', requireAuth, async (req, res) => {
  const purchased = await prisma.orderItem.findFirst({
    where: { productId: req.params.productId, order: { userId: req.user.id } },
  })
  const mine = await prisma.review.findUnique({
    where: { productId_userId: { productId: req.params.productId, userId: req.user.id } },
  })
  res.json({
    purchased: !!purchased,
    review: mine ? { rating: mine.rating, comment: mine.comment } : null,
  })
})

// POST /api/reviews { productId, rating, comment } — wajib sudah beli
router.post('/', requireAuth, async (req, res) => {
  const { productId, rating, comment } = req.body
  const r = parseInt(rating, 10)
  if (!productId || !(r >= 1 && r <= 5)) return res.status(400).json({ error: 'Data ulasan tidak valid' })

  const purchased = await prisma.orderItem.findFirst({
    where: { productId, order: { userId: req.user.id } },
  })
  if (!purchased) return res.status(403).json({ error: 'Kamu harus membeli produk ini dulu' })

  const review = await prisma.review.upsert({
    where: { productId_userId: { productId, userId: req.user.id } },
    update: { rating: r, comment: comment || '' },
    create: { productId, userId: req.user.id, name: req.user.name, avatar: req.user.picture || null, rating: r, comment: comment || '' },
  })
  res.json({ review: { name: review.name, avatar: review.avatar, rating: review.rating, comment: review.comment, date: review.createdAt } })
})

export default router
