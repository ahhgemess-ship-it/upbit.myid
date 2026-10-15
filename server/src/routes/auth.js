import { Router } from 'express'
import { prisma } from '../db.js'
import { verifyGoogleCredential, isAdminEmail, requireAuth, setSessionCookies, clearSessionCookies } from '../auth.js'

const router = Router()

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, picture: u.picture, role: u.role })

// POST /api/auth/google { credential } → verifikasi, upsert user, kembalikan token + user
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body
    if (!credential) return res.status(400).json({ error: 'credential wajib' })

    const profile = await verifyGoogleCredential(credential)
    if (!profile.email) return res.status(400).json({ error: 'Email Google tidak tersedia' })

    const computedRole = isAdminEmail(profile.email) ? 'ADMIN' : 'USER'
    const existing = await prisma.user.findUnique({ where: { email: profile.email } })
    // Jangan pernah menurunkan admin jadi USER saat login ulang:
    // - admin dari ADMIN_EMAILS tetap ADMIN
    // - admin yang dipromosikan manual di panel admin tetap ADMIN
    const role = existing && existing.role === 'ADMIN' ? 'ADMIN' : computedRole
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: { name: profile.name, picture: profile.picture, role },
      create: { email: profile.email, name: profile.name, picture: profile.picture, role },
    })

    setSessionCookies(res, user)
    res.setHeader('Cache-Control', 'private, no-store')
    res.json({ user: publicUser(user) })
  } catch (e) {
    console.error('google auth error:', e.message)
    res.status(401).json({ error: 'Verifikasi Google gagal' })
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
