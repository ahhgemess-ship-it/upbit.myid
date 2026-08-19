import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin } from '../auth.js'
import { toIDR } from '../money.js'

const router = Router()

// Minimum total transaksi untuk bisa withdraw
const MIN_WITHDRAW_TOTAL = 310000 // Rp 310.000

// Reward check-in harian: Rp 300/hari, bonus Rp 2.000 di hari ke-7
const CHECKIN_REWARD = 300
const CHECKIN_BONUS = 2000
const CHECKIN_CYCLE = 7

function startOfUtcDay(d) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
function isSameUtcDay(a, b) {
  return startOfUtcDay(a) === startOfUtcDay(b)
}
function isYesterdayUtc(d, now = new Date()) {
  const yesterday = new Date(now)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  return isSameUtcDay(d, yesterday)
}

// Cek apakah user eligible untuk withdraw (total transaksi >= 250k, dalam IDR)
async function checkWithdrawEligible(userId) {
  const orders = await prisma.order.findMany({
    where: { userId, status: 'COMPLETED' },
    select: { total: true, currency: true },
  })
  const totalIdr = orders.reduce((s, o) => s + toIDR(o.total, o.currency), 0)
  return totalIdr >= MIN_WITHDRAW_TOTAL
}

// GET /api/balance — lihat saldo & total transaksi
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id, status: 'COMPLETED' },
      select: { total: true, currency: true },
    })
    const totalSpent = orders.reduce((s, o) => s + toIDR(o.total, o.currency), 0)
    const eligible = totalSpent >= MIN_WITHDRAW_TOTAL
    res.json({
      balance: user.balance,
      totalSpent,
      minWithdraw: MIN_WITHDRAW_TOTAL,
      withdrawEligible: eligible,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/balance/history — riwayat transaksi saldo
router.get('/history', requireAuth, async (req, res) => {
  try {
    const txns = await prisma.balanceTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json(txns)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/balance/withdraw — tarik saldo (syarat: total transaksi >= 250k)
router.post('/withdraw', requireAuth, async (req, res) => {
  try {
    const { amount, method } = req.body // method: "qris" | "bank_transfer"
    const parsedAmount = parseInt(amount, 10)

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Jumlah tidak valid' })
    }

    // Cek saldo cukup
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (user.balance < parsedAmount) {
      return res.status(400).json({ error: 'Saldo tidak mencukupi' })
    }

    // Cek eligible (total transaksi >= 250k)
    const eligible = await checkWithdrawEligible(req.user.id)
    if (!eligible) {
      return res.status(400).json({
        error: 'Belum bisa tarik saldo',
        detail: `Total transaksi Anda harus minimal Rp ${MIN_WITHDRAW_TOTAL.toLocaleString('id-ID')} untuk bisa menarik saldo.`,
        minWithdraw: MIN_WITHDRAW_TOTAL,
      })
    }

    // Proses withdraw
    const [updatedUser, txn] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { balance: { decrement: parsedAmount } },
      }),
      prisma.balanceTransaction.create({
        data: {
          userId: req.user.id,
          amount: -parsedAmount,
          type: 'withdraw',
          note: `Tarik saldo via ${method || 'manual'} — Rp ${parsedAmount.toLocaleString('id-ID')}`,
        },
      }),
    ])

    res.json({
      success: true,
      balance: updatedUser.balance,
      withdrawn: parsedAmount,
      transaction: txn,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/balance/checkin/status — status check-in harian
router.get('/checkin/status', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const now = new Date()
    const alreadyToday = user.lastCheckInAt && isSameUtcDay(user.lastCheckInAt, now)
    const nextStreak = (user.checkInStreak || 0) + 1
    res.json({
      streak: user.checkInStreak || 0,
      canCheckIn: !alreadyToday,
      lastCheckInAt: user.lastCheckInAt,
      cycle: CHECKIN_CYCLE,
      reward: CHECKIN_REWARD,
      bonusDay: CHECKIN_CYCLE,
      bonus: CHECKIN_BONUS,
      rewardToday: nextStreak >= CHECKIN_CYCLE ? CHECKIN_BONUS : CHECKIN_REWARD,
      nextStreak,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/balance/checkin — klaim check-in harian
router.post('/checkin', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const now = new Date()

    // Sudah check-in hari ini?
    if (user.lastCheckInAt && isSameUtcDay(user.lastCheckInAt, now)) {
      return res.status(400).json({ error: 'Kamu sudah check-in hari ini. Kembali lagi besok!' })
    }

    // Hitung streak: lanjut kalau terakhir kemarin, selain itu mulai dari 1
    let newStreak = 1
    if (user.lastCheckInAt && isYesterdayUtc(user.lastCheckInAt, now)) {
      newStreak = (user.checkInStreak || 0) + 1
    }

    // Reward: hari ke-7 dapat bonus, setelah itu cycle dimulai ulang
    const reward = newStreak >= CHECKIN_CYCLE ? CHECKIN_BONUS : CHECKIN_REWARD
    const finalStreak = newStreak >= CHECKIN_CYCLE ? 0 : newStreak

    const [updatedUser, txn] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          balance: { increment: reward },
          checkInStreak: finalStreak,
          lastCheckInAt: now,
        },
      }),
      prisma.balanceTransaction.create({
        data: {
          userId: req.user.id,
          amount: reward,
          type: 'checkin',
          note: newStreak >= CHECKIN_CYCLE
            ? `Check-in hari ke-7 — bonus Rp ${CHECKIN_BONUS.toLocaleString('id-ID')} 🎉`
            : `Check-in harian (hari ke-${newStreak}) — Rp ${CHECKIN_REWARD.toLocaleString('id-ID')}`,
        },
      }),
    ])

    res.json({
      success: true,
      balance: updatedUser.balance,
      reward,
      streak: newStreak,
      newCycle: newStreak >= CHECKIN_CYCLE,
      transaction: txn,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Admin: tambah saldo ke user (POST /api/balance/admin/add)
router.post('/admin/add', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, amount, note } = req.body
    const parsedAmount = parseInt(amount, 10)
    if (!userId || !parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Parameter tidak valid' })
    }

    const [updatedUser, txn] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { balance: { increment: parsedAmount } },
      }),
      prisma.balanceTransaction.create({
        data: {
          userId,
          amount: parsedAmount,
          type: 'refund',
          note: note || `Admin menambahkan saldo Rp ${parsedAmount.toLocaleString('id-ID')}`,
        },
      }),
    ])

    res.json({ success: true, balance: updatedUser.balance, transaction: txn })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
