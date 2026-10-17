import crypto from 'node:crypto'

const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
const DEVICE_COOKIE = IS_PROD ? '__Host-upbit_device' : 'upbit_device'
const DEVICE_MAX_AGE = 400 * 24 * 60 * 60 * 1000
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/
const DEVICE_PEPPER = process.env.DEVICE_PEPPER || process.env.JWT_SECRET || 'local-device-pepper'

export class DeviceAccountConflict extends Error {
  constructor({ attemptedUserId, deviceId } = {}) {
    super('This device is already linked to another account.')
    this.name = 'DeviceAccountConflict'
    this.code = 'DEVICE_ACCOUNT_CONFLICT'
    this.attemptedUserId = attemptedUserId || null
    this.deviceId = deviceId || null
  }
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=')
    if (i < 1 || part.slice(0, i).trim() !== name) continue
    try { return decodeURIComponent(part.slice(i + 1).trim()) } catch { return '' }
  }
  return ''
}

export function protectedHash(value) {
  return crypto.createHmac('sha256', DEVICE_PEPPER).update(String(value)).digest('hex')
}

export function ipNetworkPrefix(value) {
  const ip = String(value || '').trim().replace(/^::ffff:/, '')
  if (!ip) return ''
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return ip.split('.').slice(0, 3).join('.') + '.0/24'
  if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':') + '::/64'
  return ''
}

function clientIp(req) {
  if (process.env.VERCEL) {
    const value = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || ''
    return String(value).split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || ''
}

export function createDeviceContext(req) {
  const suppliedToken = readCookie(req, DEVICE_COOKIE)
  const hasValidToken = TOKEN_PATTERN.test(suppliedToken)
  const token = hasValidToken ? suppliedToken : crypto.randomBytes(32).toString('base64url')
  const submittedFingerprint = String(req.body?.deviceFingerprint || '').toLowerCase()
  const fingerprintHash = FINGERPRINT_PATTERN.test(submittedFingerprint)
    ? protectedHash(`fingerprint:${submittedFingerprint}`)
    : null
  const prefix = ipNetworkPrefix(clientIp(req))
  const ipHash = prefix ? protectedHash(`ip:${prefix}`) : null
  const riskKey = fingerprintHash && ipHash
    ? protectedHash(`risk:${fingerprintHash}:${ipHash}`)
    : null

  return {
    token,
    tokenHash: protectedHash(`device:${token}`),
    isNewToken: !hasValidToken,
    fingerprintHash,
    ipHash,
    riskKey,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 255) || null,
  }
}

export function setDeviceCookie(res, token) {
  res.cookie(DEVICE_COOKIE, token, {
    secure: IS_PROD,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: DEVICE_MAX_AGE,
  })
}

const active = (device) => device && !device.releasedAt

export async function bindDeviceForLogin(tx, context, userId) {
  const now = new Date()
  let device = await tx.trustedDevice.findUnique({ where: { tokenHash: context.tokenHash } })

  if (active(device) && device.userId !== userId) {
    throw new DeviceAccountConflict({ attemptedUserId: userId, deviceId: device.id })
  }

  if (!device && context.riskKey) {
    device = await tx.trustedDevice.findUnique({ where: { riskKey: context.riskKey } })
    if (active(device) && device.userId !== userId) {
      throw new DeviceAccountConflict({ attemptedUserId: userId, deviceId: device.id })
    }
  }

  const latest = {
    userId,
    tokenHash: context.tokenHash,
    fingerprintHash: context.fingerprintHash,
    lastIpHash: context.ipHash,
    userAgent: context.userAgent,
    lastSeenAt: now,
    releasedAt: null,
  }

  if (device) {
    return tx.trustedDevice.update({
      where: { id: device.id },
      data: { ...latest, riskKey: device.riskKey || context.riskKey },
    })
  }

  return tx.trustedDevice.create({
    data: { ...latest, riskKey: context.riskKey, firstIpHash: context.ipHash },
  })
}

export async function recordAuthSecurityEvent(prisma, context, type, { userId = null, deviceId = null } = {}) {
  try {
    await prisma.authSecurityEvent.create({
      data: {
        type,
        userId,
        deviceId,
        ipHash: context.ipHash,
        fingerprintHash: context.fingerprintHash,
        userAgent: context.userAgent,
      },
    })
  } catch (error) {
    console.error('auth security audit error:', error.message)
  }
}

export async function validateSessionDevice(deviceId, userId) {
  if (!deviceId) return true
  const { prisma } = await import('./db.js')
  const device = await prisma.trustedDevice.findUnique({
    where: { id: deviceId },
    select: { userId: true, releasedAt: true },
  })
  return !!device && device.userId === userId && !device.releasedAt
}
