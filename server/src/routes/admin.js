import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import multer from 'multer'
import { fileURLToPath } from 'node:url'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { formatOrder } from './orders.js'
import { formatProduct } from './products.js'
import { encrypt } from '../crypto.js'
import { sendOrderCompleted } from '../mailer.js'
import { notify } from '../notify.js'
import { saveUpload, readUpload } from '../storage.js'

const router = Router()

// Upload gambar produk (admin) → disk (lokal) / Vercel Blob (produksi), balikan URL publik.
const productUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
})

router.use(requireAuth, requireAdmin)

// ══════════════════ USER MANAGEMENT ══════════════════

// GET /api/admin/users — list semua user (search by email/name, pagination)
router.get('/users', async (req, res) => {
  try {
    const { q, page: p = 1, pageSize: ps = 20 } = req.query
    const page = Math.max(1, parseInt(p, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(ps, 10) || 20))
    const where = {}
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ]
    }
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, picture: true, role: true,
          balance: true, checkInStreak: true, lastCheckInAt: true, createdAt: true,
          _count: { select: { orders: true, balanceTransactions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])
    res.json({ users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/admin/users/:id — detail user (saldo, orders, balance history, refund summary)
router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        orders: { orderBy: { createdAt: 'desc' }, take: 20, include: { items: true } },
        balanceTransactions: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    })
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' })

    const totalSpent = await prisma.order.aggregate({
      where: { userId: user.id, status: 'COMPLETED' },
      _sum: { total: true },
    })
    const refundOrders = user.orders.filter(o => o.refundStatus !== 'NONE')
    const totalOrders = await prisma.order.count({ where: { userId: user.id } })

    res.json({
      user: {
        id: user.id, email: user.email, name: user.name, picture: user.picture,
        role: user.role, balance: user.balance, checkInStreak: user.checkInStreak,
        lastCheckInAt: user.lastCheckInAt, createdAt: user.createdAt,
      },
      orders: user.orders,
      balanceTransactions: user.balanceTransactions,
      summary: {
        totalSpent: totalSpent._sum.total || 0,
        totalOrders,
        refundCount: refundOrders.length,
        refundApproved: refundOrders.filter(o => o.refundStatus === 'APPROVED').length,
        refundRejected: refundOrders.filter(o => o.refundStatus === 'REJECTED').length,
        refundPending: refundOrders.filter(o => o.refundStatus === 'REQUESTED').length,
      },
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PATCH /api/admin/users/:id — admin edit user (name, role, saldo adjustment)
router.patch('/users/:id', async (req, res) => {
  try {
    const { name, role, balanceAdjust, adjustNote } = req.body
    const data = {}
    if (name !== undefined) data.name = String(name).trim()
    if (role && ['USER', 'ADMIN'].includes(role)) data.role = role

    // Saldo adjustment: positif = tambah, negatif = kurangi
    const adjust = parseInt(balanceAdjust, 10)
    if (adjust && !isNaN(adjust)) {
      data.balance = { increment: adjust }
      // Catat di balance transaction
      await prisma.balanceTransaction.create({
        data: {
          userId: req.params.id,
          amount: adjust,
          type: adjust > 0 ? 'refund' : 'purchase',
          note: adjustNote || `Admin ${adjust > 0 ? 'menambah' : 'mengurangi'} saldo Rp ${Math.abs(adjust).toLocaleString('id-ID')}`,
        },
      })
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, role: true, balance: true, checkInStreak: true },
    })
    res.json({ user })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/admin/products/upload — unggah gambar produk, balikan URL publik
router.post('/products/upload', productUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File gambar wajib (PNG/JPG, maks 3MB)' })
  try {
    const url = await saveUpload(req.file.buffer, {
      prefix: 'prod', originalname: req.file.originalname, folder: 'products/', contentType: req.file.mimetype,
    })
    res.status(201).json({ url })
  } catch (e) {
    res.status(500).json({ error: 'Gagal mengunggah gambar' })
  }
})

// ---- helper: rakit data produk dari body ----
const toDate = (v) => (v ? new Date(v) : null)
function parseProductBody(b, { partial = false } = {}) {
  const d = {}
  const set = (k, v) => { if (v !== undefined) d[k] = v }
  set('name', b.name)
  set('vendor', b.vendor)
  set('category', b.category)
  set('tagline', b.tagline ?? undefined)
  set('description', b.description ?? undefined)
  if (b.features !== undefined) d.features = JSON.stringify(Array.isArray(b.features) ? b.features : [])
  set('logo', b.logo ?? undefined)
  set('brand', b.brand ?? undefined)
  set('period', b.period ?? undefined)
  if (b.rating !== undefined) d.rating = Number(b.rating) || 0
  if (b.sold !== undefined) d.sold = parseInt(b.sold, 10) || 0
  if (b.price !== undefined) d.price = parseInt(b.price, 10) || 0
  if (b.priceIntl !== undefined) d.priceIntl = parseInt(b.priceIntl, 10) || 0
  set('estimate', b.estimate ?? undefined)
  if (b.tiers !== undefined) {
    const tiers = (Array.isArray(b.tiers) ? b.tiers : []).map((t) => ({
      label: t.label,
      price: parseInt(t.price, 10) || 0,
      priceIntl: parseInt(t.priceIntl, 10) || 0,
      ...(t.note ? { note: t.note } : {}),
    }))
    d.tiers = JSON.stringify(tiers)
  }
  if (b.stock !== undefined) d.stock = parseInt(b.stock, 10)
  if (b.active !== undefined) d.active = Boolean(b.active)
  if (b.discountPercent !== undefined) d.discountPercent = Math.max(0, Math.min(90, parseInt(b.discountPercent, 10) || 0))
  if (b.discountStart !== undefined) d.discountStart = toDate(b.discountStart)
  if (b.discountEnd !== undefined) d.discountEnd = toDate(b.discountEnd)
  return d
}
const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

// GET /api/admin/orders/:id/proof — bukti transaksi (akses admin saja)
router.get('/orders/:id/proof', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order?.paymentProof) return res.status(404).json({ error: 'Tidak ada bukti' })
  const file = await readUpload(order.paymentProof)
  if (!file) return res.status(404).json({ error: 'Bukti tidak ditemukan' })
  res.setHeader('Content-Type', file.contentType)
  res.send(file.buffer)
})

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  const [counts, revByCur, pendByCur, completedItems, refundPending, lowStock] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: true }),
    prisma.order.groupBy({ by: ['currency'], where: { status: 'COMPLETED' }, _sum: { total: true } }),
    prisma.order.groupBy({ by: ['currency'], where: { status: 'PROCESSING' }, _sum: { total: true } }),
    prisma.orderItem.findMany({ where: { order: { status: 'COMPLETED' } }, select: { productId: true, name: true, qty: true, price: true, order: { select: { currency: true } } } }),
    prisma.order.count({ where: { refundStatus: 'REQUESTED' } }),
    prisma.product.count({ where: { stock: { gte: 0, lte: 3 } } }),
  ])
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count]))
  const totalOrders = counts.reduce((s, c) => s + c._count, 0)
  // Omzet dipisah per mata uang (IDR rupiah; USD & CNY dalam sen)
  const sumByCur = (rows) => { const o = { IDR: 0, USD: 0, CNY: 0 }; for (const r of rows) o[r.currency || 'IDR'] += r._sum.total || 0; return o }
  const map = {}
  for (const it of completedItems) {
    const cur = it.order?.currency || 'IDR'
    const m = (map[it.productId] ||= { productId: it.productId, name: it.name, qty: 0, revenueIDR: 0, revenueUSD: 0, revenueCNY: 0 })
    m.qty += it.qty
    if (cur === 'USD') m.revenueUSD += it.qty * it.price
    else if (cur === 'CNY') m.revenueCNY += it.qty * it.price
    else m.revenueIDR += it.qty * it.price
  }
  const topProducts = Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5)
  res.json({
    totalOrders, byStatus,
    revenue: sumByCur(revByCur),
    pendingRevenue: sumByCur(pendByCur),
    topProducts, refundPending, lowStock,
  })
})

// ============ PRODUK (CRUD) ============
router.get('/products', async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
  res.json({ products: products.map((p) => formatProduct(p, { admin: true })) })
})

router.post('/products', async (req, res) => {
  const b = req.body || {}
  if (!b.name || !b.vendor || !b.category) return res.status(400).json({ error: 'Nama, vendor, kategori wajib diisi' })
  const id = slugify(b.id || b.name) || `produk-${Date.now()}`
  const exists = await prisma.product.findUnique({ where: { id } })
  if (exists) return res.status(409).json({ error: `ID "${id}" sudah dipakai` })
  const data = parseProductBody(b)
  const firstTier = (Array.isArray(b.tiers) ? b.tiers : [])[0] || {}
  if (data.price === undefined) data.price = parseInt(firstTier.price, 10) || 0
  if (data.priceIntl === undefined) data.priceIntl = parseInt(firstTier.priceIntl, 10) || 0
  if (data.stock === undefined) data.stock = -1
  try {
    const p = await prisma.product.create({ data: { id, ...data } })
    res.status(201).json({ product: formatProduct(p, { admin: true }) })
  } catch (e) {
    res.status(400).json({ error: 'Gagal membuat produk: ' + e.message })
  }
})

router.patch('/products/:id', async (req, res) => {
  try {
    const p = await prisma.product.update({ where: { id: req.params.id }, data: parseProductBody(req.body || {}, { partial: true }) })
    res.json({ product: formatProduct(p, { admin: true }) })
  } catch {
    res.status(404).json({ error: 'Produk tidak ditemukan' })
  }
})

router.delete('/products/:id', async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Produk tidak ditemukan' })
  }
})

// ============ KUPON (CRUD) ============
router.get('/coupons', async (req, res) => {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })
  res.json({ coupons })
})

router.post('/coupons', async (req, res) => {
  const b = req.body || {}
  let code = (b.code || '').trim().toUpperCase()
  if (!code) code = 'UPB' + Math.random().toString(36).slice(2, 8).toUpperCase() // generate
  const type = b.type === 'fixed' ? 'fixed' : 'percent'
  const value = Math.max(1, parseInt(b.value, 10) || 0)
  if (!value) return res.status(400).json({ error: 'Nilai diskon wajib > 0' })
  const exists = await prisma.coupon.findUnique({ where: { code } })
  if (exists) return res.status(409).json({ error: `Kode "${code}" sudah ada` })
  try {
    const c = await prisma.coupon.create({
      data: {
        code, type, value,
        label: (b.label || '').trim() || (type === 'percent' ? `Diskon ${value}%` : `Potongan Rp ${value.toLocaleString('id-ID')}`),
        active: b.active === undefined ? true : Boolean(b.active),
        minSpend: parseInt(b.minSpend, 10) || 0,
        usageLimit: parseInt(b.usageLimit, 10) || 0,
        expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
      },
    })
    res.status(201).json({ coupon: c })
  } catch (e) {
    res.status(400).json({ error: 'Gagal membuat kupon: ' + e.message })
  }
})

router.patch('/coupons/:code', async (req, res) => {
  const b = req.body || {}
  const d = {}
  if (b.active !== undefined) d.active = Boolean(b.active)
  if (b.label !== undefined) d.label = b.label
  if (b.value !== undefined) d.value = Math.max(1, parseInt(b.value, 10) || 1)
  if (b.minSpend !== undefined) d.minSpend = parseInt(b.minSpend, 10) || 0
  if (b.usageLimit !== undefined) d.usageLimit = parseInt(b.usageLimit, 10) || 0
  if (b.expiresAt !== undefined) d.expiresAt = b.expiresAt ? new Date(b.expiresAt) : null
  try {
    const c = await prisma.coupon.update({ where: { code: req.params.code }, data: d })
    res.json({ coupon: c })
  } catch {
    res.status(404).json({ error: 'Kupon tidak ditemukan' })
  }
})

router.delete('/coupons/:code', async (req, res) => {
  try {
    await prisma.coupon.delete({ where: { code: req.params.code } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Kupon tidak ditemukan' })
  }
})

// ============ PESANAN ============
router.get('/orders', async (req, res) => {
  const { status, refund } = req.query
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 12))
  const where = {}
  if (status) where.status = status
  if (refund === 'requested') where.refundStatus = 'REQUESTED'
  const [total, orders, counts, refundCount] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, include: { items: true, user: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.order.groupBy({ by: ['status'], _count: true }),
    prisma.order.count({ where: { refundStatus: 'REQUESTED' } }),
  ])
  res.json({
    orders: orders.map((o) => formatOrder(o, { admin: true })),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
    refundCount,
    page, pageSize, total, totalPages: Math.ceil(total / pageSize),
  })
})

router.get('/orders/:id', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true, user: true } })
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' })
  res.json({ order: formatOrder(order, { admin: true }) })
})

router.patch('/orders/:id', async (req, res) => {
  const { status, adminNote } = req.body
  const data = {}
  if (status && ['PROCESSING', 'COMPLETED', 'CANCELLED'].includes(status)) data.status = status
  if (adminNote !== undefined) data.adminNote = adminNote
  const order = await prisma.order.update({ where: { id: req.params.id }, data, include: { items: true, user: true } })
  if (status === 'CANCELLED') notify(order.userId, { type: 'order_cancelled', title: `Pesanan ${order.id} dibatalkan`, body: adminNote || 'Hubungi admin bila ada pertanyaan.', orderId: order.id })
  res.json({ order: formatOrder(order, { admin: true }) })
})

// POST /api/admin/orders/:id/refund { action: 'approve'|'reject', note }
router.post('/orders/:id/refund', async (req, res) => {
  const action = req.body.action === 'approve' ? 'approve' : 'reject'
  const note = (req.body.note || '').trim() || null
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' })
  const data = action === 'approve'
    ? { refundStatus: 'APPROVED', refundNote: note, status: 'CANCELLED', refundAt: new Date() }
    : { refundStatus: 'REJECTED', refundNote: note, refundAt: new Date() }
  const updated = await prisma.order.update({ where: { id: order.id }, data, include: { items: true, user: true } })
  notify(order.userId, {
    type: 'refund_done',
    title: action === 'approve' ? `Refund ${order.id} disetujui` : `Refund ${order.id} ditolak`,
    body: note || (action === 'approve' ? 'Dana akan dikembalikan sesuai metode pembayaran.' : 'Pengajuan tidak memenuhi syarat.'),
    orderId: order.id,
  })
  res.json({ order: formatOrder(updated, { admin: true }) })
})

// POST /api/admin/orders/:id/deliver
router.post('/orders/:id/deliver', async (req, res) => {
  const { items = [], complete = true } = req.body
  await Promise.all(
    items.map((it) =>
      prisma.orderItem.update({
        where: { id: it.id },
        data: {
          credKind: it.kind || 'account',
          credEmail: it.email || null,
          credPassword: encrypt(it.password || '') || null,
          credApiKey: encrypt(it.apiKey || '') || null,
          credNote: it.note || null,
        },
      }),
    ),
  )
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: complete ? { status: 'COMPLETED' } : {},
    include: { items: true, user: true },
  })
  const formatted = formatOrder(order, { admin: true })
  if (complete && order.status === 'COMPLETED') {
    sendOrderCompleted(formatted)
    notify(order.userId, { type: 'order_completed', title: `Pesanan ${order.id} selesai`, body: 'Akses kamu sudah siap. Cek detail pesanan.', orderId: order.id })
  }
  res.json({ order: formatted })
})

export default router
