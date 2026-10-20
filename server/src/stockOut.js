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

// Harga yang sama dengan atau lebih rendah dari saldo ditutup untuk akun itu.
// Saldo nol tidak pernah menutup produk.
export function isPriceAtOrBelowUserBalance(priceIdr, balanceIdr) {
  const price = Number(priceIdr) || 0
  const balance = Number(balanceIdr) || 0
  return price > 0 && balance > 0 && price <= balance
}

export function isTierStockOutForBalance(p, tier, tierIndex, balanceIdr) {
  return isPriceAtOrBelowUserBalance(effectiveTierPriceIdr(p, tier, tierIndex), balanceIdr)
}

export function isAutoCancelPrice(priceIdr) {
  const price = Number(priceIdr) || 0
  return price >= STOCK_OUT_MIN && price <= STOCK_OUT_MAX
}

// Checkout web selalu memakai alur pencarian stok lalu batal + refund, berapa
// pun harga produknya. Helper terpisah ini sengaja tidak mengubah band lama
// yang masih dipakai bot Telegram.
export function shouldAutoCancelWebOrder() {
  return true
}

const TIER_KEY_MARKER = '::tier::'

export function tierStockKey(productId, tierLabel) {
  return `${productId}${TIER_KEY_MARKER}${encodeURIComponent(String(tierLabel || ''))}`
}

export function isTierLocked(lockSet, productId, tierLabel) {
  if (!lockSet?.size || !productId) return false
  // ID induk adalah format lama dan tetap berarti seluruh keluarga terkunci.
  return lockSet.has(productId) || lockSet.has(tierStockKey(productId, tierLabel))
}

export function tiersOfProduct(p = {}) {
  let tiers = []
  try {
    tiers = typeof p.tiers === 'string' ? JSON.parse(p.tiers || '[]') : (Array.isArray(p.tiers) ? p.tiers : [])
  } catch { tiers = [] }
  return tiers.length
    ? tiers
    : [{ label: p.period || 'Produk', price: p.price, priceIntl: p.priceIntl || 0 }]
}

export function tierLocksAtOrBelow(products = [], maxIdr, { min = STOCK_OUT_MIN } = {}) {
  const locks = []
  if (Number(maxIdr) < min) return locks
  for (const product of products) {
    tiersOfProduct(product).forEach((tier, tierIndex) => {
      const price = effectiveTierPriceIdr(product, tier, tierIndex)
      if (price >= min && price <= maxIdr) {
        locks.push({ productId: product.id, tierLabel: tier.label, key: tierStockKey(product.id, tier.label) })
      }
    })
  }
  return locks
}

// Tandai produk-produk habis untuk SATU user:
//   - produk yang dibeli (extraIds), ditambah
//   - semua produk aktif yang punya harga di [min, maxIdr].
// `tx` opsional (Prisma transaction client); tanpa tx → prisma global.
export async function cascadeUserStockOut(tx, userId, maxIdr, { min = STOCK_OUT_MIN, extraIds = [], extraTiers = null } = {}) {
  const db = tx || prisma
  // Produk yang dibeli sendiri selalu tercatat habis, terlepas dari harganya.
  // Cascade ke produk LAIN hanya berlaku bila harga beli mencapai batas bawah band.
  if (!userId) return []
  // Jalur lama tetap tersedia khusus pemanggil lama (termasuk Telegram). Jalur
  // web/admin mengirim extraTiers agar satu plan tidak menutup seluruh keluarga.
  if (Array.isArray(extraTiers)) {
    const products = maxIdr >= min
      ? await db.product.findMany({ where: { active: true } })
      : []
    const locks = new Map()
    for (const lock of tierLocksAtOrBelow(products, maxIdr, { min })) locks.set(lock.key, lock)
    for (const tier of extraTiers) {
      if (!tier?.productId) continue
      const lock = {
        productId: tier.productId,
        tierLabel: tier.tierLabel || '',
        key: tierStockKey(tier.productId, tier.tierLabel || ''),
      }
      locks.set(lock.key, lock)
    }
    if (locks.size) {
      await db.userProductStock.createMany({
        data: [...locks.values()].map((lock) => ({ userId, productId: lock.key })),
        skipDuplicates: true,
      })
    }
    return [...locks.values()]
  }

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
