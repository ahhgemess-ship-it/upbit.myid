// Rate limiter sederhana in-memory (per-user, sliding window).
// Tujuan: memperlambat farming order otomatis via script — bukan pengganti
// rate limiter global (mis. @vercel/* atau middleware express-rate-limit).
// Catatan: di serverless (Vercel functions) state in-memory per-instance;
// tetap efektif karena satu user yang spam biasanya kena instance yang sama
// dalam window singkat. Lapisan utama tetap guard refund di level DB.

const buckets = new Map() // key -> number[] (timestamps)
const MAX_KEYS = 10_000 // cegah memory leak saat di-flood banyak user berbeda

export function userRateLimit({ windowMs = 60_000, max = 10, keyFn = (req) => req.user?.id || req.ip, message = 'Terlalu banyak permintaan. Coba lagi nanti.' } = {}) {
  return (req, res, next) => {
    const key = String(keyFn(req) || 'anon')
    const now = Date.now()
    let arr = buckets.get(key)
    if (!arr) {
      if (buckets.size >= MAX_KEYS) buckets.clear() // reset sederhana saat penuh
      arr = []
      buckets.set(key, arr)
    }
    // buang timestamp di luar window
    while (arr.length && now - arr[0] > windowMs) arr.shift()
    if (arr.length >= max) {
      return res.status(429).json({ error: message })
    }
    arr.push(now)
    next()
  }
}
