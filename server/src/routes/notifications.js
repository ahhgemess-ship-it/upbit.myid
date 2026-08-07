import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

// GET /api/notifications — daftar notifikasi user (terbaru dulu)
router.get('/', async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  const unread = await prisma.notification.count({ where: { userId: req.user.id, read: false } })
  res.json({ items, unread })
})

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  const unread = await prisma.notification.count({ where: { userId: req.user.id, read: false } })
  res.json({ unread })
})

// POST /api/notifications/read-all
router.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } })
  res.json({ ok: true })
})

// POST /api/notifications/:id/read
router.post('/:id/read', async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { read: true } })
  res.json({ ok: true })
})

export default router
