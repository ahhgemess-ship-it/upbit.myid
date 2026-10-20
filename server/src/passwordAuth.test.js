import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
  verifyPassword,
} from './passwordAuth.js'

test('manual password hashing verifies the correct password only', async () => {
  const hash = await hashPassword('a-long-test-password')
  assert.equal(hash.startsWith('scrypt$'), true)
  assert.equal(await verifyPassword('a-long-test-password', hash), true)
  assert.equal(await verifyPassword('different-password', hash), false)
})

test('manual account input validation normalizes and rejects unsafe values', () => {
  assert.equal(normalizeUsername('  User.Name  '), 'user.name')
  assert.equal(isValidUsername('user.name'), true)
  assert.equal(isValidUsername('ab'), false)
  assert.equal(isValidUsername('user name'), false)
  assert.equal(isValidEmail('buyer@example.com'), true)
  assert.equal(isValidEmail('not-an-email'), false)
  assert.equal(isValidPassword('123456789'), false)
  assert.equal(isValidPassword('1234567890'), true)
})
