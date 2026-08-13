import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import couponRoutes from './routes/coupons.js'
import orderRoutes from './routes/orders.js'
import reviewRoutes from './routes/reviews.js'
import adminRoutes from './routes/admin.js'
import notificationRoutes from './routes/notifications.js'
import balanceRoutes from './routes/balance.js'
import { startRatingShuffler, shuffleSeedRatings } from './reviewShuffle.js'

const app = express()
app.set('trust proxy', 1) // di belakang proxy (Vite/Vercel) — agar rate-limit baca IP benar

app.use(cors({ origin: (process.env.CLIENT_ORIGIN || '*').split(','), credentials: true }))
app.use(express.json({ limit: '2mb' }))

// Gambar produk dilayani PUBLIK (hanya subfolder products). Bukti pembayaran di
// folder uploads/ utama TIDAK dilayani publik — tetap lewat route admin.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
app.use('/uploads/products', express.static(path.join(__dirname, '..', 'uploads', 'products')))

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'Terlalu banyak permintaan, coba lagi sebentar.' } })
const authLimiter = rateLimit({ windowMs: 60_000, max: 15, standardHeaders: true, legacyHeaders: false, message: { error: 'Terlalu banyak percobaan login, tunggu sebentar.' } })
const orderLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Terlalu banyak pesanan dalam waktu singkat.' } })

app.use('/api', apiLimiter)

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }))

// Vercel Cron memanggil ini tiap jam (lihat "crons" di vercel.json) untuk
// mengacak rating. Dilindungi CRON_SECRET (Vercel mengirim header Authorization).
app.get('/api/cron/shuffle-ratings', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' })
  try {
    const n = await shuffleSeedRatings()
    res.json({ ok: true, shuffled: n })
  } catch {
    res.status(500).json({ ok: false })
  }
})
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/coupons', couponRoutes)
app.use('/api/orders', (req, res, next) => (req.method === 'POST' ? orderLimiter(req, res, next) : next()), orderRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/balance', balanceRoutes)

app.use((req, res) => res.status(404).json({ error: 'Not found' }))

// Di lokal: jalankan HTTP server. Di Vercel (serverless): cukup export `app`
// sebagai handler — Vercel set process.env.VERCEL otomatis.
const PORT = process.env.PORT || 4000
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`EvolusiAI API berjalan di http://localhost:${PORT}`))
  startRatingShuffler() // acak rating ulasan tiap 1 jam
}

export default app
