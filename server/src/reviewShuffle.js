import { prisma } from './db.js'

// Ulasan hasil seed dimiliki user domain @reviews.local (bukan pembeli asli).
const SEED_DOMAIN = '@reviews.local'
const HOUR = 60 * 60 * 1000

// Acak ulang rating ulasan seed (mayoritas 5, sebagian 4, sedikit 3).
// Hanya menyentuh ulasan seed — ulasan pembeli asli tidak diubah.
export async function shuffleSeedRatings() {
  const seedUsers = await prisma.user.findMany({
    where: { email: { endsWith: SEED_DOMAIN } },
    select: { id: true },
  })
  const uids = seedUsers.map((u) => u.id)
  if (!uids.length) return 0

  const reviews = await prisma.review.findMany({ where: { userId: { in: uids } }, select: { id: true } })
  const ids = reviews.map((r) => r.id)
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[ids[i], ids[j]] = [ids[j], ids[i]] }

  const n = ids.length
  const five = ids.slice(0, Math.round(n * 0.62))
  const four = ids.slice(Math.round(n * 0.62), Math.round(n * 0.9))
  const three = ids.slice(Math.round(n * 0.9))
  await prisma.$transaction([
    prisma.review.updateMany({ where: { id: { in: five } }, data: { rating: 5 } }),
    prisma.review.updateMany({ where: { id: { in: four } }, data: { rating: 4 } }),
    prisma.review.updateMany({ where: { id: { in: three } }, data: { rating: 3 } }),
  ])
  return n
}

// Jalankan pengacak rating tiap 1 jam (hanya di server persisten, bukan serverless).
export function startRatingShuffler() {
  if (process.env.VERCEL) return // Vercel: gunakan Vercel Cron memanggil endpoint ini
  setInterval(() => { shuffleSeedRatings().catch(() => {}) }, HOUR)
}
