import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db.js'
import { verifyGoogleCredential, isAdminEmail, requireAuth, setSessionCookies, clearSessionCookies } from '../auth.js'
import {
  bindDeviceForLogin,
  createDeviceContext,
  DeviceAccountConflict,
  recordAuthSecurityEvent,
  setDeviceCookie,
} from '../deviceSecurity.js'
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
  verifyPassword,
} from '../passwordAuth.js'

const router = Router()

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi satu jam lagi.' },
})

const passwordLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Terlalu banyak percobaan password. Tunggu 15 menit lalu coba lagi.' },
})

const publicUser = (u) => ({ id: u.id, email: u.email, username: u.username, name: u.name, picture: u.picture, role: u.role })

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
const trustedOrigins = (process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',')
  : isProduction
    ? ['https://upbit.my.id', 'https://www.upbit.my.id']
    : ['http://localhost:5173', 'http://127.0.0.1:5173'])
  .map((origin) => origin.trim())
  .filter(Boolean)

function requireTrustedOrigin(req, res, next) {
  const origin = req.get('origin')
  if ((!origin && !isProduction) || trustedOrigins.includes(origin)) return next()
  return res.status(403).json({ error: 'Origin permintaan tidak diizinkan' })
}

function manualValidation({ username, email, password, passwordConfirm }, { registering }) {
  if (registering && !isValidUsername(username)) return 'Username harus 3-24 karakter dan hanya boleh berisi huruf kecil, angka, titik, minus, atau garis bawah.'
  if (registering && !isValidEmail(email)) return 'Email tidak valid.'
  if (!isValidPassword(password)) return 'Password harus terdiri dari 10-128 karakter.'
  if (registering && password !== passwordConfirm) return 'Konfirmasi password tidak sama.'
  return null
}

// POST /api/auth/google { credential } → verifikasi, upsert user, kembalikan token + user
router.post('/google', async (req, res) => {
  const deviceContext = createDeviceContext(req)
  try {
    const { credential } = req.body
    if (!credential) return res.status(400).json({ error: 'credential wajib' })

    const profile = await verifyGoogleCredential(credential)
    if (!profile.email) return res.status(400).json({ error: 'Email Google tidak tersedia' })

    const result = await prisma.$transaction(async (tx) => {
      const byEmail = await tx.user.findUnique({ where: { email: profile.email } })
      const bySubject = await tx.user.findUnique({ where: { googleSub: profile.googleSub } })
      if (bySubject && byEmail && bySubject.id !== byEmail.id) throw new Error('Identitas Google sudah terhubung ke akun lain')
      if (byEmail?.googleSub && byEmail.googleSub !== profile.googleSub) throw new Error('Identitas Google tidak cocok')

      const existing = bySubject || byEmail
      const computedRole = isAdminEmail(profile.email) ? 'ADMIN' : 'USER'
      const role = existing?.role === 'ADMIN' ? 'ADMIN' : computedRole
      const user = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: { googleSub: profile.googleSub, email: profile.email, name: profile.name, picture: profile.picture, role },
          })
        : await tx.user.create({
            data: { googleSub: profile.googleSub, email: profile.email, name: profile.name, picture: profile.picture, role },
          })
      const device = await bindDeviceForLogin(tx, deviceContext, user.id)
      return { user, device }
    })

    setDeviceCookie(res, deviceContext.token)
    setSessionCookies(res, result.user, result.device.id)
    await recordAuthSecurityEvent(prisma, deviceContext, 'LOGIN_ALLOWED', { userId: result.user.id, deviceId: result.device.id })
    res.setHeader('Cache-Control', 'private, no-store')
    res.json({ user: publicUser(result.user) })
  } catch (e) {
    if (e instanceof DeviceAccountConflict) {
      await recordAuthSecurityEvent(prisma, deviceContext, 'ACCOUNT_SWITCH_BLOCKED', {
        userId: e.attemptedUserId, deviceId: e.deviceId,
      })
      return res.status(409).json({
        code: e.code,
        error: 'Account abuse detected. This device is already linked to another account. Sign in with the account originally linked to this device, or contact support if you believe this is a mistake.',
      })
    }
    console.error('google auth error:', e.message)
    res.status(401).json({ error: 'Verifikasi Google gagal' })
  }
})

// POST /api/auth/register { username, email, password, passwordConfirm, deviceFingerprint }
// Pendaftaran manual tidak pernah menaikkan role berdasarkan email. Hak admin hanya
// berasal dari akun admin yang sudah ada dan autentikasi Google yang tervalidasi.
router.post('/register', registerLimiter, requireTrustedOrigin, async (req, res) => {
  const deviceContext = createDeviceContext(req)
  const username = normalizeUsername(req.body?.username)
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  const passwordConfirm = String(req.body?.passwordConfirm || '')
  const validationError = manualValidation({ username, email, password, passwordConfirm }, { registering: true })
  if (validationError) return res.status(400).json({ error: validationError })

  try {
    const passwordHash = await hashPassword(password)
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: { OR: [{ email }, { username }] },
        select: { id: true },
      })
      if (existing) {
        const error = new Error('Akun dengan username atau email tersebut sudah ada.')
        error.code = 'ACCOUNT_EXISTS'
        throw error
      }

      const user = await tx.user.create({
        data: { username, email, passwordHash, name: username, role: 'USER' },
      })
      const device = await bindDeviceForLogin(tx, deviceContext, user.id)
      return { user, device }
    })

    setDeviceCookie(res, deviceContext.token)
    setSessionCookies(res, result.user, result.device.id)
    await recordAuthSecurityEvent(prisma, deviceContext, 'PASSWORD_REGISTERED', { userId: result.user.id, deviceId: result.device.id })
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(201).json({ user: publicUser(result.user) })
  } catch (error) {
    if (error instanceof DeviceAccountConflict) {
      await recordAuthSecurityEvent(prisma, deviceContext, 'ACCOUNT_SWITCH_BLOCKED', { userId: error.attemptedUserId, deviceId: error.deviceId })
      return res.status(409).json({
        code: error.code,
        error: 'Account abuse detected. This device is already linked to another account. Sign in with the account originally linked to this device, or contact support if you believe this is a mistake.',
      })
    }
    if (error.code === 'ACCOUNT_EXISTS' || error.code === 'P2002') return res.status(409).json({ error: 'Akun dengan username atau email tersebut sudah ada.' })
    console.error('manual register error:', error.message)
    return res.status(500).json({ error: 'Pendaftaran belum dapat diproses. Coba lagi.' })
  }
})

// POST /api/auth/login { identifier, password, deviceFingerprint }
router.post('/login', passwordLoginLimiter, requireTrustedOrigin, async (req, res) => {
  const deviceContext = createDeviceContext(req)
  const identifier = String(req.body?.identifier || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  const validationError = manualValidation({ password }, { registering: false })
  if (!identifier || validationError) return res.status(400).json({ error: 'Username/email atau password tidak valid.' })

  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    })
    const passwordMatches = user?.passwordHash && await verifyPassword(password, user.passwordHash)
    if (!user || !passwordMatches || user.blocked) {
      await recordAuthSecurityEvent(prisma, deviceContext, 'PASSWORD_LOGIN_FAILED', { userId: user?.id || null })
      return res.status(401).json({ error: 'Username/email atau password salah.' })
    }

    const device = await prisma.$transaction((tx) => bindDeviceForLogin(tx, deviceContext, user.id))
    setDeviceCookie(res, deviceContext.token)
    setSessionCookies(res, user, device.id)
    await recordAuthSecurityEvent(prisma, deviceContext, 'PASSWORD_LOGIN_ALLOWED', { userId: user.id, deviceId: device.id })
    res.setHeader('Cache-Control', 'private, no-store')
    return res.json({ user: publicUser(user) })
  } catch (error) {
    if (error instanceof DeviceAccountConflict) {
      await recordAuthSecurityEvent(prisma, deviceContext, 'ACCOUNT_SWITCH_BLOCKED', { userId: error.attemptedUserId, deviceId: error.deviceId })
      return res.status(409).json({
        code: error.code,
        error: 'Account abuse detected. This device is already linked to another account. Sign in with the account originally linked to this device, or contact support if you believe this is a mistake.',
      })
    }
    console.error('manual login error:', error.message)
    return res.status(500).json({ error: 'Login belum dapat diproses. Coba lagi.' })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({ user: publicUser(req.user) })
})

// Satu kali untuk memindahkan sesi Bearer lama dari localStorage ke cookie HttpOnly.
router.post('/session', requireAuth, (req, res) => {
  setSessionCookies(res, req.user)
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({ user: publicUser(req.user) })
})

router.post('/logout', requireAuth, (req, res) => {
  clearSessionCookies(res)
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({ ok: true })
})

export default router
