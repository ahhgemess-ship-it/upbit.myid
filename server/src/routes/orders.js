import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import crypto from 'node:crypto'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { computeCoupon, consumeCoupon } from './coupons.js'
import { encrypt, decrypt } from '../crypto.js'
import { sendOrderCreated } from '../mailer.js'
import { effectiveDiscount, salePrice } from '../discount.js'
import { notify, notifyAdmins } from '../notify.js'
import { saveUpload } from '../storage.js'

const router = Router()

// Bukti pembayaran → memory, lalu disimpan ke disk (lokal) / Vercel Blob (produksi).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
})

function makeOrderId() {
  const t = new Date()
  const stamp = String(t.getFullYear()).slice(2) +
    String(t.getMonth() + 1).padStart(2, '0') +
    String(t.getDate()).padStart(2, '0')
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `UPB-${stamp}-${rand}`
}

// Bentuk order untuk klien. admin=true → sertakan semua data sensitif.
export function formatOrder(order, { admin = false } = {}) {
  const completed = order.status === 'COMPLETED'
  return {
    id: order.id,
    status: order.status,
    deliveryEmail: order.deliveryEmail,
    activation: order.activation,
    estimate: order.estimate,
    currency: order.currency || 'IDR',
    subtotal: order.subtotal,
    discount: order.discount,
    coupon: order.couponCode,
    total: order.total,
    adminNote: order.adminNote,
    refundStatus: order.refundStatus,
    refundReason: order.refundReason,
    refundNote: order.refundNote,
    refundAt: order.refundAt,
    createdAt: order.createdAt,
    payment: {
      method: order.paymentMethod,
      asset: order.paymentAsset,
      amount: order.paymentAmount,
      txHash: order.paymentTxHash,
      proofName: order.paymentProof ? path.basename(order.paymentProof) : null,
    },
    ownAccount: order.activation === 'own'
      ? { email: order.ownEmail, note: order.ownNote, ...(admin ? { password: decrypt(order.ownPassword) } : {}) }
      : null,
    items: (order.items || []).map((it) => ({
      id: it.id, productId: it.productId, name: it.name, vendor: it.vendor,
      logo: it.logo, brand: it.brand, tierLabel: it.tierLabel, price: it.price, qty: it.qty,
      credential: (admin || completed) && it.credKind
        ? { kind: it.credKind, email: it.credEmail, password: decrypt(it.credPassword), apiKey: decrypt(it.credApiKey), note: it.credNote }
        : null,
    })),
    ...(admin ? { user: order.user ? { email: order.user.email, name: order.user.name } : null } : {}),
  }
}

const STOCK_OUT_MIN = 30000
const STOCK_OUT_MAX = 80000
const isStockOutPrice = (tierPrice, currency) => currency === 'IDR' && tierPrice >= STOCK_OUT_MIN && tierPrice <= STOCK_OUT_MAX

// POST /api/orders (multipart) — buat pesanan baru
router.post('/', requireAuth, upload.single('proof'), async (req, res) => {
  try {
    const b = req.body
    const items = JSON.parse(b.items || '[]')
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Keranjang kosong' })

    const deliveryEmail = (b.deliveryEmail || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryEmail)) return res.status(400).json({ error: 'Email pengiriman tidak valid' })

    const method = b.method === 'crypto' ? 'crypto' : 'qris'
    if (method === 'qris' && !req.file) return res.status(400).json({ error: 'Bukti transaksi (QRIS) wajib diunggah' })
    if (method === 'crypto' && (b.txHash || '').trim().length < 10) return res.status(400).json({ error: 'Tx Hash tidak valid' })
    // Cegah pemakaian ulang bukti pembayaran crypto (txHash harus unik)
    if (method === 'crypto') {
      const dupe = await prisma.order.findFirst({ where: { paymentTxHash: (b.txHash || '').trim() } })
      if (dupe) return res.status(409).json({ error: 'Tx Hash ini sudah pernah dipakai untuk pesanan lain' })
    }

    // Mata uang: IDR (lokal), USD (internasional), atau CNY (Yuan). Server otoritatif.
    const USD_TO_CNY = 7.2
    const currency = b.currency === 'USD' ? 'USD' : b.currency === 'CNY' ? 'CNY' : 'IDR'

    // Validasi harga + stok sisi-server dari katalog DB
    const catalog = await prisma.product.findMany()
    const byId = Object.fromEntries(catalog.map((p) => [p.id, { ...p, tiers: JSON.parse(p.tiers) }]))

    let subtotal = 0
    let estimate = null
    const validatedItems = []
    const stockNeed = {} // productId -> qty (hanya yang stoknya terbatas)
    for (const raw of items) {
      const prod = byId[raw.id]
      if (!prod) return res.status(400).json({ error: `Produk tidak dikenal: ${raw.id}` })
      if (!prod.active) return res.status(400).json({ error: `Produk tidak tersedia: ${prod.name}` })
      const tier = prod.tiers.find((t) => t.label === raw.tierLabel) || prod.tiers[0]
      const qty = Math.max(1, Math.min(99, parseInt(raw.qty, 10) || 1))
      // Cek stok (−1 = tak terbatas). Produk 30k-80k skip stok global karena auto-refund.
      if (prod.stock !== -1 && !isStockOutPrice(tier.price, currency)) {
        stockNeed[prod.id] = (stockNeed[prod.id] || 0) + qty
        if (stockNeed[prod.id] > prod.stock) {
          return res.status(409).json({ error: `Stok ${prod.name} tidak cukup (sisa ${prod.stock})` })
        }
      }
      // Harga dasar sesuai mata uang + diskon efektif (server otoritatif).
      // Yuan diturunkan dari USD (sen) × kurs.
      const base =
        currency === 'USD' ? (tier.priceIntl || 0)
          : currency === 'CNY' ? Math.round((tier.priceIntl || 0) * USD_TO_CNY)
            : tier.price
      const pct = effectiveDiscount(prod)
      const unitPrice = salePrice(base, pct)
      subtotal += unitPrice * qty
      if (prod.estimate) estimate = prod.estimate
      validatedItems.push({
        productId: prod.id, name: prod.name, vendor: prod.vendor,
        logo: prod.logo || null, brand: prod.brand || null,
        tierLabel: tier.label, price: unitPrice, qty,
      })
    }

    const couponRes = await computeCoupon(b.couponCode, subtotal)
    // Kupon nominal tetap (fixed) hanya berlaku untuk IDR; kupon persen berlaku semua.
    let couponOk = couponRes.valid && !(currency !== 'IDR' && couponRes.type === 'fixed')

    // Reservasi stok ATOMIK (cegah oversell saat order bersamaan).
    // Decrement bersyarat `stock >= qty`; bila gagal, kembalikan yang sudah dipotong.
    const reserved = []
    for (const [id, qty] of Object.entries(stockNeed)) {
      const u = await prisma.product.updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })
      if (u.count === 0) {
        for (const r of reserved) await prisma.product.update({ where: { id: r.id }, data: { stock: { increment: r.qty } } }).catch(() => {})
        return res.status(409).json({ error: `Stok ${byId[id]?.name || id} tidak cukup` })
      }
      reserved.push({ id, qty })
    }

    // Reservasi kupon ATOMIK (cegah pemakaian melebihi kuota saat bersamaan).
    if (couponOk) couponOk = await consumeCoupon(couponRes.code)

    const discount = couponOk ? couponRes.discount : 0
    const totalBeforeBalance = Math.max(0, subtotal - discount)

    // Pakai Saldo — potong saldo user ATOMIK bersama pembuatan order (bukan di frontend).
    const useBalanceAmount = Math.max(0, parseInt(b.useBalance || '0', 10) || 0)
    let balanceUsed = 0
    if (useBalanceAmount > 0) {
      if (useBalanceAmount > totalBeforeBalance) {
        return res.status(400).json({ error: 'Jumlah saldo melebihi total belanja' })
      }
      const balUser = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } })
      if (!balUser || balUser.balance < useBalanceAmount) {
        return res.status(400).json({ error: 'Saldo tidak mencukupi' })
      }
      balanceUsed = useBalanceAmount
    }
    const total = Math.max(0, totalBeforeBalance - balanceUsed)

    // Simpan bukti pembayaran (disk lokal / Vercel Blob) → referensi disimpan di DB.
    const proofRef = req.file
      ? await saveUpload(req.file.buffer, { prefix: 'proof', originalname: req.file.originalname, contentType: req.file.mimetype })
      : null

    const activation = b.activation === 'own' ? 'own' : 'new'
    let order
    try {
      order = await prisma.$transaction(async (tx) => {
        const o = await tx.order.create({
          data: {
            id: makeOrderId(),
            userId: req.user.id,
            deliveryEmail,
            activation,
            ownEmail: activation === 'own' ? (b.ownEmail || '').trim() || null : null,
            ownPassword: activation === 'own' ? (encrypt(b.ownPassword || '') || null) : null,
            ownNote: activation === 'own' ? (b.ownNote || '').trim() || null : null,
            status: 'PROCESSING',
            estimate,
            currency,
            subtotal,
            discount,
            couponCode: couponOk ? couponRes.code : null,
            total,
            paymentMethod: method,
            paymentAsset: method === 'crypto' ? (b.asset || null) : null,
            paymentAmount: method === 'crypto' ? (b.amount || null) : null,
            paymentTxHash: method === 'crypto' ? (b.txHash || '').trim() : null,
            paymentProof: proofRef,
            items: { create: validatedItems },
          },
          include: { items: true },
        })
        if (balanceUsed > 0) {
          // Decrement atomik bersyarat: hanya jalan bila saldo >= jumlah (cegah negatif saat request bersamaan).
          const bal = await tx.user.updateMany({
            where: { id: req.user.id, balance: { gte: balanceUsed } },
            data: { balance: { decrement: balanceUsed } },
          })
          if (bal.count === 0) throw new Error('Saldo tidak mencukupi')
          await tx.balanceTransaction.create({
            data: {
              userId: req.user.id,
              amount: -balanceUsed,
              type: 'purchase',
              note: `Pakai saldo untuk pesanan ${o.id}`,
              orderId: o.id,
            },
          })
        }
        return o
      })
    } catch (e) {
      // Gagal simpan order → kembalikan reservasi stok & kupon
      for (const r of reserved) await prisma.product.update({ where: { id: r.id }, data: { stock: { increment: r.qty } } }).catch(() => {})
      if (couponOk) await prisma.coupon.update({ where: { code: couponRes.code }, data: { usedCount: { decrement: 1 } } }).catch(() => {})
      throw e
    }

    // ───────── Auto stock-out: produk harga 30.000–80.000 IDR → refund otomatis ─────────
    const hasStockOutItem = validatedItems.some((it) => {
      const prod = byId[it.productId]
      if (!prod) return false
      const tier = prod.tiers.find((t) => t.label === it.tierLabel) || prod.tiers[0]
      return isStockOutPrice(tier.price, currency)
    })

    let stockOut = false
    if (hasStockOutItem) {
      try {
        const refundAmount = balanceUsed + total // saldo yg sudah dipotong + sisa pembayaran
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED', refundStatus: 'APPROVED', refundReason: 'Stok habis', refundAt: new Date() },
          })
          for (const r of reserved) await tx.product.update({ where: { id: r.id }, data: { stock: { increment: r.qty } } }).catch(() => {})
          if (couponOk) await tx.coupon.update({ where: { code: couponRes.code }, data: { usedCount: { decrement: 1 } } }).catch(() => {})
          // Mark SEMUA produk 30k-80k sebagai stok habis untuk user ini (bukan hanya yang di order)
          const allStockOutIds = catalog
            .filter((p) => {
              const tiers = JSON.parse(p.tiers || '[]')
              return tiers.some((t) => isStockOutPrice(t.price, currency))
            })
            .map((p) => p.id)
          for (const productId of allStockOutIds) {
            await tx.userProductStock.upsert({
              where: { userId_productId: { userId: req.user.id, productId } },
              create: { userId: req.user.id, productId },
              update: {},
            })
          }
          if (refundAmount > 0) {
            await tx.user.update({ where: { id: req.user.id }, data: { balance: { increment: refundAmount } } })
            await tx.balanceTransaction.create({
              data: { userId: req.user.id, amount: refundAmount, type: 'refund', note: `Refund otomatis: stok habis — ${order.id}`, orderId: order.id },
            })
          }
        })
        order.status = 'CANCELLED'
        order.refundStatus = 'APPROVED'
        order.refundReason = 'Stok habis'
        order.refundAt = new Date()
        stockOut = true
      } catch (e) {
        console.error('stock-out refund error:', e)
      }
    }

    const formatted = formatOrder(order)
    const totalLabel =
      currency === 'USD' ? `$${(total / 100).toFixed(2)}`
        : currency === 'CNY' ? `¥${(total / 100).toFixed(2)}`
          : `Rp ${total.toLocaleString('id-ID')}`
    const msg = stockOut ? 'stok habis — otomatis refund' : 'Pembayaran sedang kami verifikasi.'
    sendOrderCreated(formatted) // email (mode log bila SMTP kosong)
    notify(req.user.id, { type: 'order_created', title: `Pesanan ${order.id} diterima`, body: msg, orderId: order.id })
    notifyAdmins({ type: 'admin_new_order', title: `Pesanan baru ${order.id}`, body: `${formatted.items.length} item · ${totalLabel}`, orderId: order.id })
    res.status(201).json({ order: formatted, stockOut })
  } catch (e) {
    console.error('create order error:', e)
    if (e.message === 'Saldo tidak mencukupi') {
      return res.status(400).json({ error: e.message })
    }
    res.status(500).json({ error: 'Gagal membuat pesanan' })
  }
})

// GET /api/orders?page=1 — pesanan milik user (paginasi)
router.get('/', requireAuth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10))
  const where = { userId: req.user.id }
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  res.json({ orders: orders.map((o) => formatOrder(o)), page, pageSize, total, totalPages: Math.ceil(total / pageSize) })
})

// GET /api/orders/:id — detail pesanan milik user
router.get('/:id', requireAuth, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } })
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Pesanan tidak ditemukan' })
  res.json({ order: formatOrder(order) })
})

// POST /api/orders/:id/refund — ajukan refund (user TIDAK membatalkan langsung)
router.post('/:id/refund', requireAuth, async (req, res) => {
  const reason = (req.body.reason || '').trim()
  if (reason.length < 5) return res.status(400).json({ error: 'Sertakan alasan refund (min. 5 karakter)' })
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order || order.userId !== req.user.id) return res.status(404).json({ error: 'Pesanan tidak ditemukan' })
  if (order.status === 'CANCELLED') return res.status(400).json({ error: 'Pesanan sudah dibatalkan' })
  if (order.refundStatus === 'REQUESTED') return res.status(400).json({ error: 'Pengajuan refund sudah dikirim, menunggu admin' })
  if (order.refundStatus === 'APPROVED') return res.status(400).json({ error: 'Refund sudah disetujui' })
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { refundStatus: 'REQUESTED', refundReason: reason, refundAt: new Date() },
    include: { items: true },
  })
  notify(req.user.id, { type: 'refund_requested', title: `Pengajuan refund ${order.id} terkirim`, body: 'Tim kami akan meninjau pengajuanmu.', orderId: order.id })
  notifyAdmins({ type: 'admin_refund', title: `Pengajuan refund ${order.id}`, body: reason.slice(0, 120), orderId: order.id })
  res.json({ order: formatOrder(updated) })
})

export default router
