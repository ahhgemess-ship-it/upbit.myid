import test from 'node:test'
import assert from 'node:assert/strict'
import { publicStockRange, randomPublicStock } from './publicStock.js'

test('stok produk di bawah 100 ribu berada pada rentang 2 sampai 5', () => {
  assert.deepEqual(publicStockRange(99_999), { min: 2, max: 5 })
  assert.equal(randomPublicStock(50_000, () => 0), 2)
  assert.equal(randomPublicStock(50_000, () => 0.999999), 5)
})

test('stok produk mulai 100 ribu berada pada rentang 3 sampai 18', () => {
  assert.deepEqual(publicStockRange(100_000), { min: 3, max: 18 })
  assert.equal(randomPublicStock(100_000, () => 0), 3)
  assert.equal(randomPublicStock(1_000_000, () => 0.999999), 18)
})
