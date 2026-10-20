import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cascadeUserStockOut,
  effectiveTierPriceIdr,
  isAutoCancelPrice,
  isPriceAtOrBelowUserBalance,
  isTierLocked,
  isTierStockOutForBalance,
  shouldAutoCancelWebOrder,
  tierLocksAtOrBelow,
  tierStockKey,
} from './stockOut.js'

test('harga sama dengan atau di bawah saldo ditandai habis', () => {
  assert.equal(isPriceAtOrBelowUserBalance(79_999, 80_000), true)
  assert.equal(isPriceAtOrBelowUserBalance(80_000, 80_000), true)
  assert.equal(isPriceAtOrBelowUserBalance(80_001, 80_000), false)
  assert.equal(isPriceAtOrBelowUserBalance(340_000, 350_000), true)
  assert.equal(isPriceAtOrBelowUserBalance(350_000, 350_000), true)
  assert.equal(isPriceAtOrBelowUserBalance(350_001, 350_000), false)
  assert.equal(isPriceAtOrBelowUserBalance(1, 0), false)
})

test('band lama bot Telegram tetap 30 ribu sampai 80 ribu', () => {
  assert.equal(isAutoCancelPrice(29_999), false)
  assert.equal(isAutoCancelPrice(30_000), true)
  assert.equal(isAutoCancelPrice(35_000), true)
  assert.equal(isAutoCancelPrice(80_000), true)
  assert.equal(isAutoCancelPrice(80_001), false)
})

test('checkout web auto-cancel untuk semua harga', () => {
  assert.equal(shouldAutoCancelWebOrder(1), true)
  assert.equal(shouldAutoCancelWebOrder(35_000), true)
  assert.equal(shouldAutoCancelWebOrder(1_500_000), true)
})

test('kunci tier murah tidak menutup tier mahal dalam keluarga yang sama', () => {
  const product = {
    id: 'chatgpt-plus',
    price: 199_000,
    tiers: [
      { label: '3 Bulan', price: 199_000 },
      { label: '6 Bulan', price: 260_000 },
      { label: '1 Tahun', price: 851_000 },
    ],
  }
  const locks = tierLocksAtOrBelow([product], 199_000)
  const lockSet = new Set(locks.map((lock) => lock.key))
  assert.equal(isTierLocked(lockSet, product.id, '3 Bulan'), true)
  assert.equal(isTierLocked(lockSet, product.id, '6 Bulan'), false)
  assert.equal(isTierLocked(lockSet, product.id, '1 Tahun'), false)
})

test('format kunci lama tetap menutup seluruh keluarga untuk kompatibilitas', () => {
  assert.equal(isTierLocked(new Set(['chatgpt-plus']), 'chatgpt-plus', '1 Tahun'), true)
  assert.equal(tierStockKey('chatgpt-plus', '1 Tahun'), 'chatgpt-plus::tier::1%20Tahun')
})

test('cascade tier menulis seluruh kunci dalam satu operasi batch', async () => {
  let batchArgs = null
  const tx = {
    product: {
      findMany: async () => [{
        id: 'chatgpt-plus',
        price: 100_000,
        active: true,
        tiers: JSON.stringify([
          { label: '1 Bulan', price: 100_000 },
          { label: '1 Tahun', price: 1_000_000 },
        ]),
      }],
    },
    userProductStock: {
      createMany: async (args) => { batchArgs = args; return { count: args.data.length } },
      upsert: async () => assert.fail('jalur tier tidak boleh menulis satu per satu'),
    },
  }
  const locks = await cascadeUserStockOut(tx, 'user-1', 1_000_000, {
    extraTiers: [{ productId: 'chatgpt-plus', tierLabel: '1 Bulan' }],
  })
  assert.equal(locks.length, 2)
  assert.equal(batchArgs.data.length, 2)
  assert.equal(batchArgs.skipDuplicates, true)
})

test('harga efektif menghormati diskon reguler', () => {
  const product = { price: 100_000, discountPercent: 20, flashSale: false }
  const tier = { price: 100_000 }
  assert.equal(effectiveTierPriceIdr(product, tier, 0), 80_000)
  assert.equal(isTierStockOutForBalance(product, tier, 0, 90_000), true)
})

test('harga efektif menghormati flash sale hanya pada tier pertama', () => {
  const product = { price: 200_000, flashSale: true, flashPrice: 70_000 }
  assert.equal(effectiveTierPriceIdr(product, { price: 200_000 }, 0), 70_000)
  assert.equal(effectiveTierPriceIdr(product, { price: 400_000 }, 1), 400_000)
  assert.equal(isTierStockOutForBalance(product, { price: 200_000 }, 0, 80_000), true)
  assert.equal(isTierStockOutForBalance(product, { price: 400_000 }, 1, 350_000), false)
})
