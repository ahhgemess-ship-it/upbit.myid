const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

// Minggu operasional dimulai Senin pukul 00.00 WIB dan berakhir tepat sebelum
// Senin berikutnya. Perhitungan tidak bergantung pada zona waktu mesin Vercel.
export function jakartaWeekPeriod(now = new Date()) {
  const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime()
  if (!Number.isFinite(timestamp)) throw new TypeError('Tanggal statistik tidak valid')

  const local = new Date(timestamp + JAKARTA_OFFSET_MS)
  const daysSinceMonday = (local.getUTCDay() + 6) % 7
  const startLocalAsUtc = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  )
  const start = new Date(startLocalAsUtc - JAKARTA_OFFSET_MS)
  const end = new Date(start.getTime() + WEEK_MS)
  return { start, end, timezone: 'Asia/Jakarta' }
}
