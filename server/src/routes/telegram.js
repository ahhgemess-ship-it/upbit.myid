// Route Telegram: webhook dari Telegram + API kode penghubung akun.
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth.js'
import { handleTelegramUpdate, flushPending, migrateBotLedger, notifyLinked } from '../telegramBot.js'

const router = Router()

// POST /api/telegram/webhook — endpoint yang dipanggil Telegram (setWebhook).
// PENTING: proses update SEBELUM membalas 200. Di Vercel serverless, fungsi
// dibekukan begitu respons terkirim — balasan fire-and-forget setelah res.json()
// tidak pernah terkirim (bug "bot tidak merespon"). Telegram bersedia menunggu
// respons hingga 60 detik; handler ini selesai dalam 1–3 detik.
router.post('/webhook', async (req, res) => {
  // Validasi secret header (diset saat setWebhook; opsional tapi disarankan)
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || ''
  if (secret && req.get('x-telegram-bot-api-secret-token') !== secret) {
    return res.status(401).json({ ok: false })
  }
  try {
    if (req.body?.update_id) await handleTelegramUpdate(req.body)
    await flushPending() // tunggu semua sendMessage/answerCallback selesai
  } catch (e) {
    console.error('telegram webhook error:', e?.message || e)
  } finally {
    res.json({ ok: true })
  }
})

// Semua endpoint di bawah butuh login website
router.use((req, res, next) => (req.path === '/webhook' ? next() : requireAuth(req, res, next)))

// POST /api/telegram/link — hubungkan akun website ke Telegram TANPA kode:
// bot mengirim tombol deep-link ?link=<telegramId> → user login di web →
// web memanggil endpoint ini dengan telegramId tersebut.
router.post('/link', async (req, res) => {
  try {
    const tgId = String(req.body?.telegramId || '').trim()
    if (!/^\d{4,15}$/.test(tgId)) {
      return res.status(400).json({ error: 'ID Telegram tidak valid — hubungkan lewat tombol di bot ya.' })
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' })
    if (user.blocked) return res.status(403).json({ error: 'Akun diblokir.' })
    if (user.telegramId === tgId) return res.json({ ok: true, linked: true, already: true })
    // Telegram ini dipakai akun website lain? → tolak (ikatan satu-satu)
    const clash = await prisma.user.findFirst({ where: { telegramId: tgId } })
    if (clash && clash.id !== user.id) {
      return res.status(409).json({ error: 'Telegram ini sudah terhubung ke akun website lain. Hubungi admin untuk melepas ikatan.' })
    }
    const migrated = await migrateBotLedger(tgId, user.id)
    await prisma.user.update({ where: { id: user.id }, data: { telegramId: tgId } })
    // Konfirmasi ke chat bot (di-await supaya tidak hilang di serverless)
    await notifyLinked(tgId, user, migrated)
    res.json({ ok: true, linked: true })
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
    res.json({ linked: !!user?.telegramId, botUsername: process.env.TELEGRAM_BOT_USERNAME || null })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
