import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt)
const SCRYPT_COST = 16_384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELISM = 1
const KEY_LENGTH = 64
const MAX_MEMORY = 64 * 1024 * 1024

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{2,23}$/

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function isValidUsername(value) {
  return USERNAME_PATTERN.test(normalizeUsername(value))
}

export function isValidEmail(value) {
  const email = normalizeEmail(value)
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidPassword(value) {
  const password = String(value || '')
  return password.length >= 10 && password.length <= 128
}

export async function hashPassword(value) {
  const password = String(value || '')
  const salt = crypto.randomBytes(16)
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
    maxmem: MAX_MEMORY,
  })
  return ['scrypt', SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELISM, salt.toString('base64url'), derived.toString('base64url')].join('$')
}

export async function verifyPassword(value, storedHash) {
  const parts = String(storedHash || '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, cost, blockSize, parallelism, encodedSalt, encodedKey] = parts
  const N = Number(cost)
  const r = Number(blockSize)
  const p = Number(parallelism)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N < 2 || r < 1 || p < 1) return false

  try {
    const salt = Buffer.from(encodedSalt, 'base64url')
    const expected = Buffer.from(encodedKey, 'base64url')
    if (!salt.length || !expected.length) return false
    const derived = await scrypt(String(value || ''), salt, expected.length, {
      N,
      r,
      p,
      maxmem: MAX_MEMORY,
    })
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}
