import { Prisma } from '@prisma/client'
import { prisma } from './db.js'
import { buildPersonas, COMMENTS, pick, weightedRating } from './reviewContent.js'

// Ulasan hasil seed dimiliki user domain @reviews.local (bukan pembeli asli).
const SEED_DOMAIN = '@reviews.local'
const DAY = 24 * 60 * 60 * 1000

// Hash FNV-1a sederhana (deterministik) — untuk distribusi tanggal harian.
function fnv(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const dateKey = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Perbarui tanggal ulasan seed SETIAP HARI agar selalu tampak fresh untuk
// marketing (paling baru = hari ini/kemarin). Algoritma deterministik per hari:
// umur tiap ulasan dihitung dari hash(reviewId + tanggal hari ini) sehingga
// stabil sepanjang hari (tidak berubah tiap jam), tapi berubah keesokan harinya.
// Distribusi: mayoritas 0-7 hari lalu, sebagian 8-21, sisanya sampai ~60 hari.
// Dioptimalkan: SATU query UPDATE ... CASE untuk semua ulasan (frontend hanya
// menampilkan tanggal tanpa jam, jadi waktu dalam sehari tak perlu unik).
export async function refreshReviewDates() {
  // Satu query: ulasan milik user seed (filter via relasi), tanpa query user dulu.
  const reviews = await prisma.review.findMany({
    where: { user: { email: { endsWith: SEED_DOMAIN } } },
    select: { id: true },
  })
  if (!reviews.length) return 0
  const today = dateKey()
  const now = Date.now()
  const byDay = new Map() // daysAgo -> [id, ...]
  for (const r of reviews) {
    const seed = fnv(`${r.id}|${today}`)
    const bucket = seed % 100
    const daysAgo = bucket < 55 ? seed % 8 : bucket < 85 ? 8 + (seed % 14) : 22 + (seed % 39)
    const arr = byDay.get(daysAgo) || []
    arr.push(r.id)
    byDay.set(daysAgo, arr)
  }
  const idList = []
  const whens = []
  for (const [daysAgo, ids] of byDay) {
    const ts = new Date(now - daysAgo * DAY)
    for (const id of ids) {
      idList.push(id)
      whens.push(Prisma.sql`WHEN ${id} THEN ${ts}`)
    }
  }
  if (idList.length) {
    await prisma.$queryRaw`
      UPDATE "Review" SET "createdAt" = CASE "id"
        ${Prisma.join(whens, ' ')}
        ELSE "createdAt" END
      WHERE "id" IN (${Prisma.join(idList)})
    `
  }
  return reviews.length
}

// Acak ulang rating ulasan seed (mayoritas 5, sebagian 4, sedikit 3).
// Hanya menyentuh ulasan seed — ulasan pembeli asli tidak diubah.
export async function shuffleSeedRatings() {
  // Satu query: ulasan milik user seed (filter via relasi), tanpa query user dulu.
  const reviews = await prisma.review.findMany({
    where: { user: { email: { endsWith: SEED_DOMAIN } } },
    select: { id: true },
  })
  const ids = reviews.map((r) => r.id)
  if (!ids.length) return 0
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[ids[i], ids[j]] = [ids[j], ids[i]] }

  const n = ids.length
  const five = ids.slice(0, Math.round(n * 0.62))
  const four = ids.slice(Math.round(n * 0.62), Math.round(n * 0.9))
  const three = ids.slice(Math.round(n * 0.9))
  // SATU query UPDATE ... CASE (menggantikan 3 updateMany) — jauh lebih cepat.
  if (ids.length) {
    await prisma.$queryRaw`
      UPDATE "Review" SET "rating" = CASE
        WHEN "id" IN (${Prisma.join(five)}) THEN 5
        WHEN "id" IN (${Prisma.join(four)}) THEN 4
        WHEN "id" IN (${Prisma.join(three)}) THEN 3
        ELSE "rating" END
      WHERE "id" IN (${Prisma.join(ids)})
    `
  }
  return n
}

// Tambahkan 1-2 ulasan BARU ke setiap produk setiap hari supaya jumlah terus
// bertambah (efek marketing: toko terlihat makin ramai). Idempoten:
// - Pemilihan persona ditentukan hash(tanggal + produk) → hari yang sama selalu
//   menghasilkan kandidat yang sama, jadi re-run tidak menambah duplikat.
// - `createMany` dengan skipDuplicates + constraint unik (productId, userId)
//   menjamin tidak ada (produk, reviewer) yang terpakai 2× — ulasan bertambah
//   1-2 per produk per hari sampai semua persona terpakai untuk produk itu.
// - createdAt ditaruh HARI INI (beberapa jam lalu) → tampil "Hari ini".
export async function addDailyReviews() {
  const today = dateKey()
  const personas = buildPersonas()
  const emails = personas.map((p) => p.email)

  const products = await prisma.product.findMany({ select: { id: true } })
  if (!products.length) return 0

  // Pasangan (productId, userId) yang sudah dipakai — hindari unik & duplikat.
  const existing = await prisma.review.findMany({ select: { productId: true, userId: true } })
  const used = new Set(existing.map((r) => `${r.productId}|${r.userId}`))

  // Persona yang sudah terdaftar sebagai user (dibuat saat seed).
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, name: true, picture: true },
  })
  const byEmail = new Map(users.map((u) => [u.email, u]))

  const now = Date.now()
  const rows = []
  for (const p of products) {
    const base = fnv(`${p.id}|daily|${today}`)
    const n = 1 + (base % 2) // 1-2 ulasan baru untuk produk ini hari ini
    for (let i = 0; i < n; i++) {
      // Pemilihan persona MURNI deterministik per (produk, tanggal, slot):
      // hash yang sama → persona yang sama. Tidak ada walk-forward — kalau
      // persona slot ini sudah pernah mengulas produk tsb (dari seed/hari
      // sebelumnya), slot dilewati. Karena itu re-run di hari yang sama selalu
      // menghasilkan 0 (idempoten), dan esok harinya hash berubah → persona baru.
      const persona = personas[fnv(`${p.id}|daily|${today}|slot${i}`) % personas.length]
      const u = byEmail.get(persona.email)
      if (!u || used.has(`${p.id}|${u.id}`)) continue
      used.add(`${p.id}|${u.id}`)
      rows.push({
        productId: p.id,
        userId: u.id,
        name: u.name,
        avatar: u.picture || persona.avatar,
        rating: weightedRating(),
        comment: pick(COMMENTS[persona.lang] || COMMENTS.en),
        // Hari ini, beberapa jam lalu (deterministik per slot) → label "Hari ini".
        createdAt: new Date(now - (fnv(`${p.id}|${today}|t${i}`) % 12) * 3600_000),
      })
    }
  }
  if (!rows.length) return 0
  const { count } = await prisma.review.createMany({ data: rows, skipDuplicates: true })
  return count
}

// Jalankan pengacak rating + refresh tanggal + penambah ulasan harian SEKALI
// SEHARI (24 jam), plus sekali saat server start. Di Vercel sudah ada Cron
// 1×/hari (vercel.json) yang memanggil /api/cron/shuffle-ratings — interval
// ini hanya untuk lokal. Jalankan paralel (kolom/entitas berbeda, aman).
export function startRatingShuffler() {
  if (process.env.VERCEL) return // Vercel: gunakan Vercel Cron memanggil endpoint ini
  const runAll = () => Promise.all([shuffleSeedRatings(), refreshReviewDates(), addDailyReviews()]).catch(() => {})
  runAll() // langsung segarkan saat start
  setInterval(runAll, DAY) // lalu SEKALI SEHARI (24 jam)
}
