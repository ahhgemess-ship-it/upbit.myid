// Route top-up saldo user:
//   POST /api/balance/topup — buat pengajuan (multipart: proof untuk QRIS)
//   GET  /api/balance/topup — riwayat top-up user ini
// Bonus: base >= 50.000 → +10%. Kredit saldo HANYA lewat approve admin.
import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { saveUpload } from '../storage.js'
import { notify, notifyAdmins } from '../notify.js'
import { sendTelegramToUser } from '../telegramBot.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

const MIN_TOPUP = 5000
const BONUS_MIN_BASE = 50000
const BONUS_PCT = 10
const METHODS = ['qris', 'alipay', 'paygo', 'crypto']

// TOP-XXXXXX (6 char aman tanpa ambigu)
function makeTopupId() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)]
  return `TOP-${s}`
}

// GET /api/balance/topup — riwayat top-up user
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.topupRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/balance/topup — buat pengajuan top-up
router.post('/', requireAuth, upload.single('proof'), async (req, res) => {
  try {
    const b = req.body || {}
    const base = parseInt(b.baseAmount, 10)
    const method = METHODS.includes(b.method) ? b.method : null
    if (!method) return res.status(400).json({ error: 'Metode pembayaran tidak valid' })
    if (!Number.isSafeInteger(base) || base < MIN_TOPUP) {
      return res.status(400).json({ error: `Minimal top-up Rp ${MIN_TOPUP.toLocaleString('id-ID')}` })
    }

    const bonusPct = base >= BONUS_MIN_BASE ? BONUS_PCT : 0
    const amount = base + Math.round((base * bonusPct) / 100)

    // Validasi per metode:
    //  - qris → wajib upload bukti transfer
    //  - crypto → wajib tx hash (>= 10 char) + aset
    //  - alipay/paygo → wajib nomor referensi (>= 6 char)
    let proofRef = null
    const txRef = (b.txRef || '').trim()
    if (method === 'qris') {
      if (!req.file) return res.status(400).json({ error: 'Bukti transfer (screenshot) wajib diunggah' })
      if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Bukti harus berupa gambar' })
      proofRef = await saveUpload(req.file.buffer, {
        prefix: 'topup', originalname: req.file.originalname, contentType: req.file.mimetype,
      })
    } else if (method === 'crypto') {
      if (!b.asset) return res.status(400).json({ error: 'Pilih aset crypto (BNB/USDT)' })
      if (txRef.length < 10) return res.status(400).json({ error: 'Tx Hash tidak valid' })
    } else if (txRef.length < 6) {
      return res.status(400).json({ error: 'Nomor referensi pembayaran wajib diisi' })
    }

    const topup = await prisma.topupRequest.create({
      data: {
        id: makeTopupId(),
        userId: req.user.id,
        baseAmount: base,
        amount,
        bonusPct,
        method,
        asset: method === 'crypto' ? String(b.asset).slice(0, 10) : null,
        payAmount: (b.payAmount || '').toString().slice(0, 40) || null,
        txRef: txRef.slice(0, 120) || null,
        proof: proofRef,
      },
    })

    notify(req.user.id, {
      type: 'topup_pending',
      title: `Pengajuan top-up ${topup.id} diterima`,
      body: `Menunggu verifikasi admin. Saldo +Rp ${amount.toLocaleString('id-ID')} masuk setelah disetujui.`,
    })
    notifyAdmins({
      type: 'admin_topup',
      title: `Top-up baru ${topup.id}`,
      body: `${req.user.name} · Rp ${base.toLocaleString('id-ID')} via ${method.toUpperCase()}${bonusPct ? ` (+${bonusPct}%)` : ''}`,
    })

    res.status(201).json({ topup })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Helper dipakai route admin (didefinisikan di admin.js):
export async function approveTopup(topupId, adminNote) {
  const current = await prisma.topupRequest.findUnique({ where: { id: topupId } })
  if (!current) return { error: 404, message: 'Top-up tidak ditemukan' }
  if (current.status !== 'PENDING') return { error: 400, message: 'Top-up sudah diproses' }
  const [user, txn] = await prisma.$transaction([
    prisma.user.update({ where: { id: current.userId }, data: { balance: { increment: current.amount } } }),
    prisma.balanceTransaction.create({
      data: { userId: current.userId, amount: current.amount, type: 'refund', note: `Top-up saldo ${current.id} (bonus ${current.bonusPct}%)` },
    }),
    prisma.topupRequest.update({
      where: { id: current.id },
      data: { status: 'APPROVED', adminNote: adminNote || null, approvedAt: new Date() },
    }),
  ])
  notify(current.userId, {
    type: 'topup_approved',
    title: `Top-up ${current.id} disetujui`,
    body: `+Rp ${current.amount.toLocaleString('id-ID')} sudah masuk ke Saldo kamu.`,
  })
  sendTelegramToUser(current.userId, 'notifRefund', { id: current.id, amount: 'Rp ' + Number(current.amount).toLocaleString('id-ID') })
  return { user, txn, topup: current }
}

export async function rejectTopup(topupId, adminNote) {
  const current = await prisma.topupRequest.findUnique({ where: { id: topupId } })
  if (!current) return { error: 404, message: 'Top-up tidak ditemukan' }
  if (current.status !== 'PENDING') return { error: 400, message: 'Top-up sudah diproses' }
  const topup = await prisma.topupRequest.update({
    where: { id: current.id },
    data: { status: 'REJECTED', adminNote: adminNote || null },
  })
  notify(current.userId, {
    type: 'topup_rejected',
    title: `Top-up ${current.id} ditolak`,
    body: adminNote || 'Hubungi admin untuk info lebih lanjut.',
  })
  return { topup }
}

export default router
