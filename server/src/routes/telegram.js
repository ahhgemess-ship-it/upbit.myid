// Route Telegram: webhook dari Telegram + API kode penghubung akun.
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { handleTelegramUpdate } from '../telegramBot.js'

const router = Router()

// POST /api/telegram/webhook — endpoint yang dipanggil Telegram (setWebhook).
// Ringan: Telegram butuh respons cepat; balasan dikirim fire-and-forget.
router.post('/webhook', async (req, res) => {
  // Validasi secret header (diset saat setWebhook; opsional tapi disarankan)
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  if (secret && req.get('x-telegram-bot-api-secret-token') !== secret) {
    return res.status(401).json({ ok: false })
  }
  res.json({ ok: true }) // balas cepat, proses setelahnya
  try {
    if (req.body?.update_id) await handleTelegramUpdate(req.body)
  } catch (e) {
    console.error('telegram webhook error:', e.message)
  }
})

// Semua endpoint di bawah butuh login website
router.use((req, res, next) => (req.path === '/webhook' ? next() : requireAuth(req, res, next)))

// POST /api/telegram/link-code — buat kode 6 digit (berlaku 15 menit) untuk
// menghubungkan akun website ke Telegram via /start KODE.
router.post('/link-code', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' })
    if (user.telegramId) {
      return res.status(400).json({ error: 'Akun sudah terhubung ke Telegram.' })
    }
    // Hapus kode lama milik user ini, lalu buat kode unik baru
    await prisma.telegramLinkCode.deleteMany({ where: { userId: user.id } })
    let code = ''
    for (let i = 0; i < 5; i++) {
      code = String(Math.floor(100000 + Math.random() * 900000))
      const exists = await prisma.telegramLinkCode.findUnique({ where: { code } })
      if (!exists) break
      code = ''
    }
    if (!code) return res.status(500).json({ error: 'Gagal membuat kode, coba lagi' })
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    await prisma.telegramLinkCode.create({ data: { code, userId: user.id, expiresAt } })
    res.json({ code, expiresAt, botUsername: process.env.TELEGRAM_BOT_USERNAME || null })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/telegram/status — status koneksi Telegram akun ini
router.get('/status', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { telegramId: true },
    })
    res.json({ linked: !!user?.telegramId })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/telegram/link-code — hapus kode aktif milik user (mis. dibatalkan)
router.delete('/link-code', async (req, res) => {
  try {
    await prisma.telegramLinkCode.deleteMany({ where: { userId: req.user.id } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
