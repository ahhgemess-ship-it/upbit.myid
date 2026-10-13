import test from 'node:test'
import assert from 'node:assert/strict'
import {
  effectiveTierPriceIdr,
  isPriceBelowUserBalance,
  isTierStockOutForBalance,
} from './stockOut.js'

test('harga di bawah saldo ditandai habis secara strict', () => {
  assert.equal(isPriceBelowUserBalance(79_999, 80_000), true)
  assert.equal(isPriceBelowUserBalance(80_000, 80_000), false)
  assert.equal(isPriceBelowUserBalance(80_001, 80_000), false)
  assert.equal(isPriceBelowUserBalance(340_000, 350_000), true)
  assert.equal(isPriceBelowUserBalance(1, 0), false)
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
