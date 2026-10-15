import test from 'node:test'
import assert from 'node:assert/strict'
import { refundableAmount } from './routes/orders.js'

test('refund yang sudah disetujui tidak dapat dikreditkan dua kali', () => {
  const order = { status: 'CANCELLED', refundStatus: 'APPROVED', total: 35_000, currency: 'IDR' }
  assert.equal(refundableAmount(order, 0), 0)
})

test('auto-cancel menunggu verifikasi dapat direfund ke saldo', () => {
  const order = { status: 'CANCELLED', refundStatus: 'REQUESTED', total: 35_455, currency: 'IDR' }
  assert.equal(refundableAmount(order, 0), 35_455)
})

test('pesanan batal tanpa pengajuan refund tidak menghasilkan saldo', () => {
  const order = { status: 'CANCELLED', refundStatus: 'NONE', total: 35_455, currency: 'IDR' }
  assert.equal(refundableAmount(order, 0), 0)
})

test('refund pesanan selesai mencakup saldo terpakai dan pembayaran tersisa', () => {
  const order = { status: 'COMPLETED', refundStatus: 'REQUESTED', total: 30_000, currency: 'IDR' }
  assert.equal(refundableAmount(order, 5_000), 35_000)
})
