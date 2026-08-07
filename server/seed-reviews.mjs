import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Ulasan demo untuk produk promo baru (flash sale)
const PRODUCT_IDS = ['claude-pro-promo-multi', 'chatgpt-plus-promo-multi', 'chatgpt-pro-promo-multi', 'chatgpt-pro-promo-4bln', 'claude-max-5x-promo-multi']

const REVIEW_POOL = [
  { name: 'Rizky Pratama', rating: 5, comment: 'Prosesnya cepat, akun langsung aktif. Recommended!' },
  { name: 'Siti Nurhaliza', rating: 5, comment: 'Harga promo jauh lebih murah dari resmi, garansi juga ada. Mantap!' },
  { name: 'Budi Santoso', rating: 4, comment: 'Pengiriman agak lama dikit tapi hasilnya memuaskan.' },
  { name: 'Andi Wijaya', rating: 5, comment: 'Sudah 3x beli disini, selalu aman dan terpercaya.' },
  { name: 'Dewi Lestari', rating: 4, comment: 'Akun works, cs responsif. Nice!' },
  { name: 'Fajar Ramadhan', rating: 5, comment: 'Beneran ori, dapat semua fitur premium. Puas banget!' },
  { name: 'Maya Angelina', rating: 5, comment: 'Cepat, mudah, aman. Bakal repeat order.' },
  { name: 'Agus Salim', rating: 4, comment: 'Good seller, akun langsung bisa dipakai.' },
]

// Buat user demo (kalau belum ada) untuk melekatkan ulasan
async function ensureUsers() {
  const users = []
  for (let i = 0; i < REVIEW_POOL.length; i++) {
    const rp = REVIEW_POOL[i]
    const email = `review.${(rp.name || 'user' + i).toLowerCase().replace(/[^a-z0-9]+/g, '.')}.${i}@upbitapps.my.id`
    const u = await prisma.user.upsert({
      where: { email },
      update: { name: rp.name },
      create: { email, name: rp.name },
    })
    users.push({ user: u, pool: rp })
  }
  return users
}

async function main() {
  const users = await ensureUsers()
  let total = 0
  for (const productId of PRODUCT_IDS) {
    const prod = await prisma.product.findUnique({ where: { id: productId } })
    if (!prod) {
      console.log(`SKIP (produk belum ada di DB): ${productId}`)
      continue
    }
    // 3 ulasan per produk, dari user berbeda
    const picks = users.slice((total * 3) % users.length, (total * 3) % users.length + 3)
    if (picks.length < 3) picks.push(...users.slice(0, 3 - picks.length))
    for (const { user, pool } of picks) {
      await prisma.review.upsert({
        where: { productId_userId: { productId, userId: user.id } },
        update: { rating: pool.rating, comment: pool.comment },
        create: {
          productId,
          userId: user.id,
          name: pool.name,
          rating: pool.rating,
          comment: pool.comment,
        },
      })
      total++
    }
    console.log(`Ulasan untuk ${productId}: 3`)
  }
  console.log(`Selesai: ${total} ulasan dibuat.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
