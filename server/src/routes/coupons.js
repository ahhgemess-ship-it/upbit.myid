import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

// Hitung diskon kupon + alasan jika tidak valid. Tidak mengubah usedCount.
export async function computeCoupon(code, subtotal) {
  if (!code) return { valid: false, discount: 0, label: '', code: '', error: 'Kode kupon kosong' }
  const c = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } })
  if (!c || !c.active) return { valid: false, discount: 0, label: '', code: '', error: 'Kode kupon tidak valid' }
  if (c.expiresAt && new Date() > new Date(c.expiresAt)) return { valid: false, discount: 0, label: '', code: '', error: 'Kupon sudah kedaluwarsa' }
  if (c.usageLimit > 0 && c.usedCount >= c.usageLimit) return { valid: false, discount: 0, label: '', code: '', error: 'Kuota kupon habis' }
  if (subtotal < c.minSpend) return { valid: false, discount: 0, label: '', code: '', error: `Min. belanja Rp ${c.minSpend.toLocaleString('id-ID')}` }
  const discount = c.type === 'percent'
    ? Math.round((subtotal * c.value) / 100)
    : Math.min(c.value, subtotal)
  return { valid: true, discount, label: c.label, code: c.code, type: c.type }
}

// Reservasi pemakaian kupon secara ATOMIK. Mengembalikan true bila berhasil.
// Untuk kupon berkuota, increment hanya jika usedCount masih < usageLimit —
// satu query updateMany bersyarat sehingga order bersamaan tak bisa menembus kuota.
export async function consumeCoupon(code) {
  if (!code) return false
  try {
    const c = await prisma.coupon.findUnique({ where: { code } })
    if (!c) return false
    if (c.usageLimit > 0) {
      const r = await prisma.coupon.updateMany({
        where: { code, usedCount: { lt: c.usageLimit } },
        data: { usedCount: { increment: 1 } },
      })
      return r.count > 0
    }
    await prisma.coupon.update({ where: { code }, data: { usedCount: { increment: 1 } } })
    return true
  } catch {
    return false
  }
}

// POST /api/coupons/validate { code, subtotal }
router.post('/validate', async (req, res) => {
  const { code, subtotal } = req.body
  const result = await computeCoupon(code, Number(subtotal) || 0)
  if (!result.valid) return res.status(404).json({ valid: false, error: result.error })
  res.json(result)
})

export default router
