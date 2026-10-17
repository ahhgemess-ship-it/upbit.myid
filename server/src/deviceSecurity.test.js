import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bindDeviceForLogin,
  DeviceAccountConflict,
  ipNetworkPrefix,
  protectedHash,
} from './deviceSecurity.js'

function context(overrides = {}) {
  return {
    tokenHash: protectedHash('device:test-token'),
    fingerprintHash: protectedHash('fingerprint:test'),
    ipHash: protectedHash('ip:192.0.2.0/24'),
    riskKey: protectedHash('risk:test'),
    userAgent: 'Test Browser',
    ...overrides,
  }
}

function txWith(device = null) {
  const writes = []
  return {
    writes,
    trustedDevice: {
      findUnique: async ({ where }) => {
        if (!device) return null
        if (where.tokenHash && where.tokenHash === device.tokenHash) return device
        if (where.riskKey && where.riskKey === device.riskKey) return device
        return null
      },
      update: async ({ where, data }) => {
        writes.push({ kind: 'update', where, data })
        return { ...device, ...data, id: device.id }
      },
      create: async ({ data }) => {
        writes.push({ kind: 'create', data })
        return { ...data, id: 'device-new' }
      },
    },
  }
}

test('IP disimpan sebagai kelompok jaringan, bukan alamat lengkap', () => {
  assert.equal(ipNetworkPrefix('192.0.2.91'), '192.0.2.0/24')
  assert.equal(ipNetworkPrefix('::ffff:203.0.113.45'), '203.0.113.0/24')
  assert.equal(ipNetworkPrefix('2001:db8:abcd:12:34::1'), '2001:db8:abcd:12::/64')
})

test('HMAC tidak menyimpan nilai fingerprint asli', () => {
  const hash = protectedHash('fingerprint-rahasia')
  assert.match(hash, /^[a-f0-9]{64}$/)
  assert.notEqual(hash, 'fingerprint-rahasia')
})

test('perangkat baru diikat ke akun pertama', async () => {
  const tx = txWith()
  const result = await bindDeviceForLogin(tx, context(), 'user-a')
  assert.equal(result.userId, 'user-a')
  assert.equal(tx.writes[0].kind, 'create')
})

test('akun yang sama boleh login ulang dari perangkat terikat', async () => {
  const ctx = context()
  const tx = txWith({ id: 'device-1', userId: 'user-a', tokenHash: ctx.tokenHash, riskKey: ctx.riskKey, releasedAt: null })
  const result = await bindDeviceForLogin(tx, ctx, 'user-a')
  assert.equal(result.userId, 'user-a')
  assert.equal(tx.writes[0].kind, 'update')
})

test('akun berbeda ditolak pada perangkat yang masih terikat', async () => {
  const ctx = context()
  const tx = txWith({ id: 'device-1', userId: 'user-a', tokenHash: ctx.tokenHash, riskKey: ctx.riskKey, releasedAt: null })
  await assert.rejects(
    () => bindDeviceForLogin(tx, ctx, 'user-b'),
    (error) => error instanceof DeviceAccountConflict && error.code === 'DEVICE_ACCOUNT_CONFLICT',
  )
  assert.equal(tx.writes.length, 0)
})

test('perangkat yang dilepas admin dapat diikat ke akun baru', async () => {
  const ctx = context()
  const tx = txWith({ id: 'device-1', userId: 'user-a', tokenHash: ctx.tokenHash, riskKey: ctx.riskKey, releasedAt: new Date() })
  const result = await bindDeviceForLogin(tx, ctx, 'user-b')
  assert.equal(result.userId, 'user-b')
  assert.equal(result.releasedAt, null)
})
