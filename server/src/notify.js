import { prisma } from './db.js'

// Buat notifikasi in-app untuk satu user. Fire-and-forget (tidak menggagalkan request).
export async function notify(userId, { type, title, body = null, orderId = null }) {
  try {
    await prisma.notification.create({ data: { userId, type, title, body, orderId } })
  } catch (e) {
    console.error('notify error:', e.message)
  }
}

// Broadcast ke semua admin.
export async function notifyAdmins({ type, title, body = null, orderId = null }) {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    if (admins.length) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({ userId: a.id, type, title, body, orderId })),
      })
    }
  } catch (e) {
    console.error('notifyAdmins error:', e.message)
  }
}
