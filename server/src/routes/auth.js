import { Router } from 'express'
import { prisma } from '../db.js'
import { verifyGoogleCredential, isAdminEmail, requireAuth, setSessionCookies, clearSessionCookies } from '../auth.js'
import {
  bindDeviceForLogin,
  createDeviceContext,
  DeviceAccountConflict,
  recordAuthSecurityEvent,
  setDeviceCookie,
} from '../deviceSecurity.js'

const router = Router()

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, picture: u.picture, role: u.role })

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
