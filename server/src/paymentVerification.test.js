import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectRecognizedProof, numericCandidates } from './paymentVerification.js'

test('membaca nominal rupiah dengan pemisah titik', () => {
  assert.ok(numericCandidates('Total Rp 35.455', 'IDR').includes(35_455))
})

test('membaca nominal dua desimal untuk MYR, USD, dan CNY', () => {
  assert.ok(numericCandidates('RM 8.11', 'MYR').includes(8.11))
  assert.ok(numericCandidates('USD 2,01', 'USD').includes(2.01))
  assert.ok(numericCandidates('¥ 13.45', 'CNY').includes(13.45))
})

test('menerima status berhasil dalam seluruh bahasa antarmuka', () => {
  const samples = [
    'Payment successful Rp 35.455',
    'Pembayaran berhasil Rp 35.455',
    'Bayaran berjaya Rp 35.455',
    '支付 成 功 Rp 35.455',
    '支払い完了 Rp 35.455',
    'Оплачено успешно Rp 35.455',
    'भुगतान सफल Rp 35.455',
    'Zahlung erfolgreich Rp 35.455',
    'Giao dịch thành công Rp 35.455',
  ]
  for (const text of samples) {
    assert.equal(inspectRecognizedProof({ text, confidence: 88, expectedAmount: 35_455, currency: 'IDR' }).accepted, true, text)
  }
})

test('menolak nominal berbeda, status tertunda, dan OCR buram', () => {
  assert.equal(inspectRecognizedProof({ text: 'Pembayaran berhasil Rp 20.000', confidence: 90, expectedAmount: 35_455 }).accepted, false)
  assert.equal(inspectRecognizedProof({ text: 'Payment pending Rp 35.455', confidence: 90, expectedAmount: 35_455 }).accepted, false)
  assert.equal(inspectRecognizedProof({ text: 'Pembayaran berhasil Rp 35.455', confidence: 20, expectedAmount: 35_455 }).accepted, false)
})
