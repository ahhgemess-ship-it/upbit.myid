import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
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

export const isAdminEmail = (email) => ADMIN_EMAILS.includes((email || '').toLowerCase())

// Verifikasi credential (ID token) dari Google Identity Services.
export async function verifyGoogleCredential(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  })
  const p = ticket.getPayload()
  return { email: (p.email || '').toLowerCase(), name: p.name || p.email, picture: p.picture || null }
}

export const signToken = (user) =>
  jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' })

// Middleware: wajib login. Menaruh user lengkap di req.user.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Tidak ada token' })
    const payload = jwt.verify(token, JWT_SECRET)
    const user = await prisma.user.findUnique({ where: { id: payload.uid } })
    if (!user) return res.status(401).json({ error: 'User tidak ditemukan' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Token tidak valid' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Khusus admin' })
  next()
}
