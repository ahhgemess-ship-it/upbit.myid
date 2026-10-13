// Cascade STOK HABIS PER USER — dipakai bersama oleh:
//   - routes/orders.js  (checkout web)
//   - telegramBot.js    (checkout bot)
//   - routes/admin.js   (pesanan manual admin / verifikasi pembayaran)
// Aturan: user yang membayar produk seharga X (IDR) akan melihat SEMUA produk
// aktif dengan harga di [MIN_BAND, X] sebagai stok habis — untuk akun itu saja
// (tabel UserProductStock, tidak mengubah stok global).
import { prisma } from './db.js'
import { effectiveDiscount, salePrice } from './discount.js'

// Batas bawah cascade. Harga di bawah ini tidak ikut dicatat habis.
export const STOCK_OUT_MIN = 30000
// Batas atas band AUTO-CANCEL: purchase dalam [MIN..MAX] langsung dibatalkan
// otomatis + refund + cascade langsung saat create order (harga 80k ke bawah
// dianggap "promo wall"). Purchase di atas MAX diproses normal; cascade-nya
// baru aktif saat pembayaran berhasil (verifikasi admin).
export const STOCK_OUT_MAX = 80000

// Kumpulan harga IDR sebuah produk: harga dasar + semua tier + harga flash.
// `p.tiers` bisa JSON string (dari DB) atau sudah array.
export function pricesOfProduct(p = {}) {
  let tiers = []
  try {
    tiers = typeof p.tiers === 'string' ? JSON.parse(p.tiers || '[]') : (Array.isArray(p.tiers) ? p.tiers : [])
  } catch { tiers = [] }
  const list = [Number(p.price) || 0, ...tiers.map((t) => Number(t?.price) || 0)]
  if (p.flashSale && Number(p.flashPrice) > 0) list.push(Number(p.flashPrice))
  return list.filter((n) => n > 0)
}

// Harga efektif tier dalam IDR untuk aturan stok berbasis saldo. IDR menjadi
// sumber tunggal; pilihan bahasa/mata uang di frontend hanya mengubah tampilan.
export function effectiveTierPriceIdr(p = {}, tier = {}, tierIndex = 0) {
  const flashPrice = Number(p.flashPrice) || 0
  const basePrice = p.flashSale && tierIndex === 0 && flashPrice > 0
    ? flashPrice
    : (Number(tier?.price) || Number(p.price) || 0)
  const discount = p.flashSale ? 0 : effectiveDiscount(p)
  return salePrice(basePrice, discount)
}

// "Di bawah saldo" bersifat strict: harga yang sama persis dengan saldo masih
// tersedia. Saldo nol tidak pernah menutup produk.
export function isPriceBelowUserBalance(priceIdr, balanceIdr) {
  const price = Number(priceIdr) || 0
  const balance = Number(balanceIdr) || 0
  return price > 0 && balance > 0 && price < balance
}

export function isTierStockOutForBalance(p, tier, tierIndex, balanceIdr) {
  return isPriceBelowUserBalance(effectiveTierPriceIdr(p, tier, tierIndex), balanceIdr)
}

// Tandai produk-produk habis untuk SATU user:
//   - produk yang dibeli (extraIds), ditambah
//   - semua produk aktif yang punya harga di [min, maxIdr].
// `tx` opsional (Prisma transaction client); tanpa tx → prisma global.
export async function cascadeUserStockOut(tx, userId, maxIdr, { min = STOCK_OUT_MIN, extraIds = [] } = {}) {
  const db = tx || prisma
  // Produk yang dibeli sendiri selalu tercatat habis, terlepas dari harganya.
  // Cascade ke produk LAIN hanya berlaku bila harga beli mencapai batas bawah band.
  if (!userId) return []
  const ids = new Set(extraIds)
  if (maxIdr >= min) {
    const products = await db.product.findMany({ where: { active: true } })
    for (const p of products) {
      if (pricesOfProduct(p).some((pr) => pr >= min && pr <= maxIdr)) ids.add(p.id)
    }
  }
  for (const productId of ids) {
    await db.userProductStock.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    })
  }
  return [...ids]
}
