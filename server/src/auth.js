import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import crypto from 'node:crypto'
import { prisma } from './db.js'

// Di produksi (Vercel/NODE_ENV=production) JWT_SECRET WAJIB diset — jangan
// diam-diam pakai 'dev-secret' yang publik (bisa dipakai memalsukan token admin).
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL
if (IS_PROD && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET wajib diset di environment produksi.')
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)
const SESSION_COOKIE = IS_PROD ? '__Host-upbit_session' : 'upbit_session'
const CSRF_COOKIE = IS_PROD ? '__Host-upbit_csrf' : 'upbit_csrf'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const isAdminEmail = (email) => ADMIN_EMAILS.includes((email || '').toLowerCase())

// Verifikasi credential (ID token) dari Google Identity Services.
export async function verifyGoogleCredential(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  })
  const p = ticket.getPayload()
  if (!p?.sub || p.email_verified !== true) throw new Error('Email Google belum terverifikasi')
  return { googleSub: p.sub, email: (p.email || '').toLowerCase(), name: p.name || p.email, picture: p.picture || null }
}

const sessionTtl = (user) => user.role === 'ADMIN' ? 30 * 60 : 7 * 24 * 60 * 60

export const signToken = (user, deviceId = null) => jwt.sign(
  { uid: user.id, role: user.role, ...(deviceId ? { did: deviceId } : {}) },
  JWT_SECRET,
  { expiresIn: sessionTtl(user), algorithm: 'HS256' },
)

function parseCookies(req) {
  const out = {}
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=')
    if (i < 1) continue
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()) } catch { /* ignore */ }
  }
  return out
}

function safeEqual(a, b) {
  if (!a || !b) return false
  const aa = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb)
}

export function setSessionCookies(res, user, deviceId = null) {
  const maxAge = sessionTtl(user) * 1000
  const csrf = crypto.randomBytes(32).toString('base64url')
  const base = { secure: IS_PROD, sameSite: 'strict', path: '/', maxAge }
  res.cookie(SESSION_COOKIE, signToken(user, deviceId), { ...base, httpOnly: true })
  res.cookie(CSRF_COOKIE, csrf, { ...base, httpOnly: false })
}

export function clearSessionCookies(res) {
  const base = { secure: IS_PROD, sameSite: 'strict', path: '/' }
  res.clearCookie(SESSION_COOKIE, { ...base, httpOnly: true })
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false })
}

// Middleware: wajib login. Menaruh user lengkap di req.user.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null
    const cookies = parseCookies(req)
    const token = bearer || cookies[SESSION_COOKIE]
    if (!token) return res.status(401).json({ error: 'Tidak ada token' })
    if (!bearer && UNSAFE_METHODS.has(req.method)) {
      const csrfHeader = req.headers['x-csrf-token']
      if (!safeEqual(csrfHeader, cookies[CSRF_COOKIE])) return res.status(403).json({ error: 'CSRF token tidak valid' })
    }
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
    const user = await prisma.user.findUnique({ where: { id: payload.uid } })
    if (!user) return res.status(401).json({ error: 'User tidak ditemukan' })
    if (user.blocked) return res.status(403).json({ error: 'Akun diblokir. Hubungi admin jika ini keliru.' })
    if (payload.did) {
      const device = await prisma.trustedDevice.findUnique({
        where: { id: payload.did }, select: { userId: true, releasedAt: true },
      })
      if (!device || device.userId !== user.id || device.releasedAt) {
        return res.status(401).json({ error: 'Sesi perangkat tidak berlaku', code: 'DEVICE_SESSION_INVALID' })
      }
    }
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Token tidak valid' })
  }
}

// Middleware: opsional login. Menaruh user di req.user bila ada token valid, lanjut jika tidak ada.
export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const cookies = parseCookies(req)
    const token = header.startsWith('Bearer ') ? header.slice(7) : cookies[SESSION_COOKIE]
    if (!token) return next()
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
    const user = await prisma.user.findUnique({ where: { id: payload.uid } })
    let validDevice = true
    if (user && payload.did) {
      const device = await prisma.trustedDevice.findUnique({
        where: { id: payload.did }, select: { userId: true, releasedAt: true },
      })
      validDevice = !!device && device.userId === user.id && !device.releasedAt
    }
    if (user && !user.blocked && validDevice) {
      req.user = user
    }
  } catch {
    // token tidak valid / kadaluarsa — abaikan di optionalAuth
  }
  next()
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Khusus admin' })
  next()
}
