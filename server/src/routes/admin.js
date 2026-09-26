import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import multer from 'multer'
import { fileURLToPath } from 'node:url'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { formatOrder, refundableAmount } from './orders.js'
import { formatProduct } from './products.js'
import { encrypt } from '../crypto.js'
import { sendOrderCompleted } from '../mailer.js'
import { notify } from '../notify.js'
import { sendTelegramToUser } from '../telegramBot.js'
import { approveTopup, rejectTopup } from './topup.js'
import { saveUpload, readUpload } from '../storage.js'
import { toIDR } from '../money.js'

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
          balance: true, minWithdraw: true, checkInStreak: true, lastCheckInAt: true, createdAt: true,
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

    const spentOrders = await prisma.order.findMany({
      where: { userId: user.id, status: 'COMPLETED' },
      select: { total: true, currency: true },
    })
    const totalSpent = spentOrders.reduce((s, o) => s + toIDR(o.total, o.currency), 0)
    const refundOrders = user.orders.filter(o => o.refundStatus !== 'NONE')
    const totalOrders = await prisma.order.count({ where: { userId: user.id } })

    res.json({
      user: {
        id: user.id, email: user.email, name: user.name, picture: user.picture,
        role: user.role, blocked: user.blocked, balance: user.balance, minWithdraw: user.minWithdraw, checkInStreak: user.checkInStreak,
        lastCheckInAt: user.lastCheckInAt, createdAt: user.createdAt,
      },
      orders: user.orders,
      balanceTransactions: user.balanceTransactions,
      summary: {
        totalSpent,
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

// PATCH /api/admin/users/:id — admin edit user (name, role, saldo absolut, blokir)
router.patch('/users/:id', async (req, res) => {
  try {
    const { name, role, balance, balanceAdjust, adjustNote, blocked, minWithdraw } = req.body || {}
    const data = {}
    if (name !== undefined) data.name = String(name).trim()
    if (role && ['USER', 'ADMIN'].includes(role)) data.role = role
    if (blocked !== undefined) {
      if (req.user.id === req.params.id && blocked) return res.status(400).json({ error: 'Tidak bisa memblokir akun sendiri' })
      data.blocked = Boolean(blocked)
    }
    // Override minimal tarik saldo per user: string/number angka >= 0, atau kosong = reset ke default global.
    if (minWithdraw !== undefined) {
      if (minWithdraw === '' || minWithdraw === null) {
        data.minWithdraw = null
      } else {
        const v = Number(minWithdraw)
        if (!Number.isSafeInteger(v) || v < 0 || v > 2_000_000_000) {
          return res.status(400).json({ error: 'Min. tarik saldo harus angka bulat 0 atau lebih (kosongkan = default global)' })
        }
        data.minWithdraw = v
      }
    }

    // Saldo harus berupa nilai akhir absolut, bukan nominal yang ditambahkan.
    // balanceAdjust dipertahankan hanya untuk kompatibilitas client lama dan tidak dipakai lagi.
    const hasBalance = Object.prototype.hasOwnProperty.call(req.body || {}, 'balance')
    let targetBalance = null
    if (hasBalance) {
      if (balance === '' || balance === null || balance === undefined || !/^\d+$/.test(String(balance))) {
        return res.status(400).json({ error: 'Saldo harus berupa angka bulat 0 atau lebih' })
      }
      targetBalance = Number(balance)
      if (!Number.isSafeInteger(targetBalance) || targetBalance < 0 || targetBalance > 2_000_000_000) {
        return res.status(400).json({ error: 'Nilai saldo di luar batas yang diizinkan' })
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: req.params.id }, select: { balance: true } })
      if (!current) return null

      const delta = targetBalance === null ? 0 : targetBalance - current.balance
      const user = await tx.user.update({
        where: { id: req.params.id },
        data: { ...data, ...(targetBalance === null ? {} : { balance: targetBalance }) },
        select: { id: true, email: true, name: true, role: true, balance: true, minWithdraw: true, checkInStreak: true },
      })

      if (targetBalance !== null && delta !== 0) {
        await tx.balanceTransaction.create({
          data: {
            userId: req.params.id,
            amount: delta,
            type: delta > 0 ? 'refund' : 'purchase',
            note: adjustNote || `Admin mengedit saldo menjadi Rp ${targetBalance.toLocaleString('id-ID')}`,
          },
        })
      }
      return { user, delta }
    })

    if (!result) return res.status(404).json({ error: 'User tidak ditemukan' })
    res.json({ user: result.user, balanceDelta: result.delta })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/admin/settings — pengaturan global toko (saat ini: default min tarik saldo)
router.get('/settings', async (req, res) => {
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'minWithdraw' } })
    const v = s ? parseInt(s.value, 10) : NaN
    res.json({ minWithdraw: Number.isSafeInteger(v) && v >= 0 ? v : 310000 })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/admin/settings — ubah pengaturan global toko
router.put('/settings', async (req, res) => {
  try {
    const { minWithdraw } = req.body || {}
    const v = Number(minWithdraw)
    if (!Number.isSafeInteger(v) || v < 0 || v > 2_000_000_000) {
      return res.status(400).json({ error: 'Min. tarik saldo harus angka bulat 0 atau lebih' })
    }
    await prisma.setting.upsert({
      where: { key: 'minWithdraw' },
      update: { value: String(v) },
      create: { key: 'minWithdraw', value: String(v) },
    })
    res.json({ minWithdraw: v })
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
  // badge & warna bisa dikosongkan lewat null/'' (mis. admin menghapus badge Private/Sharing)
  if (b.badge !== undefined) d.badge = (b.badge || '').trim() || null
  if (b.badgeColor !== undefined) d.badgeColor = (b.badgeColor || '').trim() || null
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
  if (b.flashSale !== undefined) d.flashSale = Boolean(b.flashSale)
  if (b.stockOut !== undefined) d.stockOut = Boolean(b.stockOut)
  if (b.flashPrice !== undefined) d.flashPrice = b.flashPrice === null || b.flashPrice === '' ? null : parseInt(b.flashPrice, 10)
  if (b.flashPriceIntl !== undefined) d.flashPriceIntl = b.flashPriceIntl === null || b.flashPriceIntl === '' ? null : parseInt(b.flashPriceIntl, 10)
  if (b.discountPercent !== undefined) d.discountPercent = Math.max(0, Math.min(90, parseInt(b.discountPercent, 10) || 0))
  if (b.discountStart !== undefined) d.discountStart = toDate(b.discountStart)
  if (b.discountEnd !== undefined) d.discountEnd = toDate(b.discountEnd)
  return d
}
const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

// ══════════════════ ORDER MANAGEMENT: tambah & edit manual ══════════════════

// POST /api/admin/orders — tambah pesanan manual (offline/walk-in): tanpa pembayaran,
// langsung masuk sebagai pesanan yang bisa dikelola & dicetak struknya.
router.post('/orders', async (req, res) => {
  try {
    const { userId, deliveryEmail, items, adminNote, markCompleted } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'Pilih pembeli (user)' })
    const emailOk = (deliveryEmail || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOk)) return res.status(400).json({ error: 'Email pengiriman tidak valid' })
    const list = Array.isArray(items) ? items : []
    if (!list.length) return res.status(400).json({ error: 'Minimal satu produk' })

    const buyer = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
    if (!buyer) return res.status(404).json({ error: 'User pembeli tidak ditemukan' })

    const catalog = await prisma.product.findMany()
    const byId = Object.fromEntries(catalog.map((p) => [p.id, p]))

    let subtotal = 0
    let estimate = null
    const rows = []
    for (const raw of list) {
      const prod = byId[raw.id]
      if (!prod) return res.status(400).json({ error: `Produk tidak dikenal: ${raw.id}` })
      const tiers = JSON.parse(prod.tiers || '[]')
      const idx = Math.max(0, parseInt(raw.tierIndex, 10) || 0)
      const tier = tiers[idx] || tiers[0]
      if (!tier) return res.status(400).json({ error: `Produk ${prod.name} tidak punya tier harga` })
      const qty = Math.max(1, Math.min(99, parseInt(raw.qty, 10) || 1))
      const price = Math.max(0, Math.round(Number(tier.price) || 0))
      subtotal += price * qty
      if (prod.estimate) estimate = prod.estimate
      rows.push({
        productId: prod.id, name: prod.name, vendor: prod.vendor,
        logo: prod.logo || null, brand: prod.brand || null,
        tierLabel: tier.label, price, qty,
      })
    }
    const total = subtotal
    const t = new Date()
    const stamp = String(t.getFullYear()).slice(2) + String(t.getMonth() + 1).padStart(2, '0') + String(t.getDate()).padStart(2, '0')
    const id = `EVO-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

    const order = await prisma.order.create({
      data: {
        id,
        userId: buyer.id,
        deliveryEmail: emailOk,
        activation: 'new',
        status: markCompleted ? 'COMPLETED' : 'PROCESSING',
        estimate,
        currency: 'IDR',
        subtotal,
        discount: 0,
        total,
        paymentMethod: 'manual', // bukan qris/crypto → tidak dianggap butuh verifikasi pembayaran
        adminNote: (adminNote || '').trim() || null,
        items: { create: rows },
      },
      include: { items: true, user: true },
    })
    res.json({ order: formatOrder(order, { admin: true }) })
  } catch (e) {
    console.error('admin create order:', e.message)
    res.status(500).json({ error: 'Gagal membuat pesanan' })
  }
})

// PATCH /api/admin/orders/:id — edit pesanan (email kirim, catatan, status,
// metode pembayaran + referensi, dan tanggal transaksi untuk struk).
// Pesanan COMPLETED dikunci: hanya catatan & data struk yang boleh diubah (audit aman).
router.patch('/orders/:id', async (req, res) => {
  try {
    const cur = await prisma.order.findUnique({ where: { id: req.params.id } })
    if (!cur) return res.status(404).json({ error: 'Pesanan tidak ditemukan' })
    const b = req.body || {}
    const data = {}
    if (b.adminNote !== undefined) data.adminNote = (b.adminNote || '').trim() || null
    // Data struk/transaksi: boleh diedit kapan pun (termasuk pesanan selesai)
    if (b.paymentMethod !== undefined && ['qris', 'crypto', 'manual'].includes(b.paymentMethod)) data.paymentMethod = b.paymentMethod
    if (b.paymentAsset !== undefined) data.paymentAsset = (b.paymentAsset || '').trim() || null
    if (b.paymentTxHash !== undefined) data.paymentTxHash = (b.paymentTxHash || '').trim() || null
    if (b.paymentAmount !== undefined) data.paymentAmount = (b.paymentAmount || '').trim() || null
    if (b.paidAt !== undefined) {
      if (!b.paidAt) {
        data.paidAt = null
      } else {
        const d = new Date(b.paidAt)
        if (isNaN(d.getTime())) return res.status(400).json({ error: 'Tanggal transaksi tidak valid' })
        data.paidAt = d
      }
    }
    // Nama & email pembeli (user) — tampil di struk & daftar pesanan.
    // Kosong = tidak diubah (bagian dari payload selalu dikirim frontend).
    if (b.buyerName !== undefined && String(b.buyerName).trim() !== '') data.user = { update: { name: String(b.buyerName).trim() } }
    if (b.buyerEmail !== undefined && String(b.buyerEmail).trim() !== '') {
      const em = String(b.buyerEmail).trim()
      if (!/^\S+@\S+\.\S+$/.test(em)) return res.status(400).json({ error: 'Email pembeli tidak valid' })
      const clash = await prisma.user.findUnique({ where: { email: em }, select: { id: true } })
      if (clash && clash.id !== cur.userId) return res.status(409).json({ error: 'Email sudah dipakai akun lain' })
      data.user = { ...(data.user || {}), update: { ...(data.user?.update || {}), email: em } }
    }
    if (cur.status !== 'COMPLETED') {
      if (b.deliveryEmail !== undefined) {
        const em = (b.deliveryEmail || '').trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return res.status(400).json({ error: 'Email tidak valid' })
        data.deliveryEmail = em
      }
      if (b.status && ['PROCESSING', 'CANCELLED'].includes(b.status)) data.status = b.status
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Tidak ada perubahan yang diizinkan' })
    const order = await prisma.order.update({ where: { id: cur.id }, data, include: { items: true, user: true } })
    res.json({ order: formatOrder(order, { admin: true }) })
  } catch (e) {
    console.error('admin edit order:', e.message)
    res.status(500).json({ error: 'Gagal mengedit pesanan' })
  }
})

// DELETE /api/admin/orders/:id — hapus transaksi permanen (semua status).
// Item pesanan terhapus otomatis (cascade). Dipakai untuk membereskan pesanan
// uji/tes yang tidak seharusnya masuk laporan & statistik.
router.delete('/orders/:id', async (req, res) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Pesanan tidak ditemukan' })
  }
})

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

// POST /api/admin/orders/:id/cancel — batalkan pesanan + refund ke Saldo user.
// Idempoten: pesanan yang sudah CANCELLED/refund disetujui TIDAK direfund lagi (anti double-refund).
async function cancelOrderHandler(req, res) {
  const { status, adminNote } = req.body
  const current = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } })
  if (!current) return res.status(404).json({ error: 'Pesanan tidak ditemukan' })

  const data = {}
  if (status && ['PROCESSING', 'COMPLETED', 'CANCELLED'].includes(status)) data.status = status
  if (adminNote !== undefined) data.adminNote = adminNote

  let order
  // ANTI-REFUND-FARMING: satu pesanan hanya boleh direfund sekali. Tanpa guard ini,
  // klik "Batalkan" berulang (atau cancel setelah auto stock-out refund) menambah saldo
  // lagi setiap kali — itu yang dipakai user untuk farming saldo gratis.
  const alreadyRefunded = current.status === 'CANCELLED' || current.refundStatus === 'APPROVED'
  if (status === 'CANCELLED' && current.status !== 'CANCELLED') {
    // Rollback: kembalikan saldo terpakai + sisa pembayaran, kuota kupon, dan stok.
    const usedTx = await prisma.balanceTransaction.findFirst({ where: { orderId: current.id, type: 'purchase' } })
    const balanceUsed = usedTx ? Math.abs(usedTx.amount) : 0
    const refundAmount = alreadyRefunded ? 0 : refundableAmount(current, balanceUsed)
    order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({ where: { id: current.id }, data, include: { items: true, user: true } })
      if (refundAmount > 0) {
        await tx.user.update({ where: { id: current.userId }, data: { balance: { increment: refundAmount } } })
        await tx.balanceTransaction.create({
          data: { userId: current.userId, amount: refundAmount, type: 'refund', note: `Pesanan dibatalkan admin — ${current.id}`, orderId: current.id },
        })
      }
      // Kembalikan stok hanya untuk produk dengan stok terbatas (>= 0).
      for (const it of current.items || []) {
        if (it.productId) {
          await tx.product.updateMany({ where: { id: it.productId, stock: { gte: 0 } }, data: { stock: { increment: it.qty } } }).catch(() => {})
        }
      }
      // Kembalikan kuota kupon bila order memakai kupon.
      if (current.couponCode) {
        await tx.coupon.updateMany({ where: { code: current.couponCode, usedCount: { gte: 1 } }, data: { usedCount: { decrement: 1 } } }).catch(() => {})
      }
      return o
    })
  } else {
    order = await prisma.order.update({ where: { id: current.id }, data, include: { items: true, user: true } })
  }

  if (status === 'CANCELLED' && current.status !== 'CANCELLED') {
    notify(order.userId, { type: 'order_cancelled', title: `Pesanan ${order.id} dibatalkan`, body: refundAmount > 0 ? 'Dana sudah dikembalikan ke Saldo kamu.' : (adminNote || 'Pesanan dibatalkan.'), orderId: order.id })
    sendTelegramToUser(order.userId, 'notifCancelled', { id: order.id, refund: refundAmount > 0 ? `↩️ +<b>Rp ${Number(refundAmount).toLocaleString('id-ID')}</b> kembali ke Saldo.` : '' })
  }
  res.json({ order: formatOrder(order, { admin: true }) })
}

router.post('/orders/:id/cancel', cancelOrderHandler)

// ── Top-up saldo: verifikasi & kredit ──
router.get('/topups', requireAdmin, async (req, res) => {
  try {
    const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(req.query.status) ? req.query.status : undefined
    const rows = await prisma.topupRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    })
    const nPending = await prisma.topupRequest.count({ where: { status: 'PENDING' } })
    res.json({ rows, nPending })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/topups/:id/approve', requireAdmin, async (req, res) => {
  try {
    const out = await approveTopup(req.params.id, req.body?.adminNote)
    if (out.error) return res.status(out.error).json({ error: out.message })
    res.json({ ok: true, balance: out.user.balance })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/topups/:id/reject', requireAdmin, async (req, res) => {
  try {
    const out = await rejectTopup(req.params.id, req.body?.adminNote)
    if (out.error) return res.status(out.error).json({ error: out.message })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Alias kompatibilitas frontend: PATCH dengan status CANCELLED diarahkan ke handler cancel
// yang sama (idempoten — pesanan yang sudah direfund tidak direfund lagi).
router.patch('/orders/:id', async (req, res) => {
  const { status, adminNote } = req.body || {}
  if (status === 'CANCELLED') {
    req.body = { status: 'CANCELLED', adminNote }
    return cancelOrderHandler(req, res)
  }
  const data = {}
  if (status && ['PROCESSING', 'COMPLETED', 'CANCELLED'].includes(status)) data.status = status
  if (adminNote !== undefined) data.adminNote = adminNote
  const order = await prisma.order.update({ where: { id: req.params.id }, data, include: { items: true, user: true } }).catch(() => null)
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' })
  return res.json({ order: formatOrder(order, { admin: true }) })
})

// POST /api/admin/orders/:id/refund { action: 'approve'|'reject', note }
router.post('/orders/:id/refund', async (req, res) => {
  const action = req.body.action === 'approve' ? 'approve' : 'reject'
  const note = (req.body.note || '').trim() || null
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return res.status(404).json({ error: 'Pesanan tidak ditemukan' })

  let updated
  if (action === 'approve') {
    // Kembalikan dana ke Saldo user (saldo terpakai + sisa pembayaran, dikonversi ke IDR).
    // Idempoten: refund disetujui hanya dijalankan SEKALI per pesanan (anti double-refund).
    const wasApproved = order.refundStatus === 'APPROVED' || order.status === 'CANCELLED'
    const usedTx = await prisma.balanceTransaction.findFirst({ where: { orderId: order.id, type: 'purchase' } })
    const balanceUsed = usedTx ? Math.abs(usedTx.amount) : 0
    const refundAmount = wasApproved ? 0 : refundableAmount(order, balanceUsed)
    updated = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: order.id },
        data: { refundStatus: 'APPROVED', refundNote: note, status: 'CANCELLED', refundAt: new Date() },
        include: { items: true, user: true },
      })
      if (!wasApproved && refundAmount > 0) {
        await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: refundAmount } } })
        await tx.balanceTransaction.create({
          data: { userId: order.userId, amount: refundAmount, type: 'refund', note: `Refund disetujui admin — ${order.id}`, orderId: order.id },
        })
      }
      return o
    })
  } else {
    updated = await prisma.order.update({
      where: { id: order.id },
      data: { refundStatus: 'REJECTED', refundNote: note, refundAt: new Date() },
      include: { items: true, user: true },
    })
  }

  notify(order.userId, {
    type: 'refund_done',
    title: action === 'approve' ? `Refund ${order.id} disetujui` : `Refund ${order.id} ditolak`,
    body: note || (action === 'approve' ? 'Dana sudah dikembalikan ke Saldo kamu.' : 'Pengajuan tidak memenuhi syarat.'),
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
    sendTelegramToUser(order.userId, 'notifCompleted', { id: order.id })
  }
  res.json({ order: formatted })
})

export default router
