import test from 'node:test'
import assert from 'node:assert/strict'
import { jakartaWeekPeriod } from './statsPeriod.js'

test('periode mingguan memakai Senin 00.00 WIB', () => {
  const period = jakartaWeekPeriod(new Date('2026-10-15T12:00:00.000Z'))
  assert.equal(period.start.toISOString(), '2026-10-11T17:00:00.000Z')
  assert.equal(period.end.toISOString(), '2026-10-18T17:00:00.000Z')
  assert.equal(period.timezone, 'Asia/Jakarta')
})

test('Minggu malam WIB masih termasuk periode yang sama', () => {
  const period = jakartaWeekPeriod(new Date('2026-10-18T16:59:59.999Z'))
  assert.equal(period.start.toISOString(), '2026-10-11T17:00:00.000Z')
  assert.equal(period.end.toISOString(), '2026-10-18T17:00:00.000Z')
})
