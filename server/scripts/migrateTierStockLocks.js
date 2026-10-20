import { prisma } from '../src/db.js'
import { effectiveTierPriceIdr, STOCK_OUT_MIN, tierStockKey, tiersOfProduct } from '../src/stockOut.js'
import { toIDR } from '../src/money.js'

const apply = process.argv.includes('--apply')

try {
  const products = await prisma.product.findMany()
  const multiTier = new Map(
    products
      .map((product) => [product.id, { product, tiers: tiersOfProduct(product) }])
      .filter(([, value]) => value.tiers.length > 1),
  )
  const legacyLocks = await prisma.userProductStock.findMany({
    where: { productId: { in: [...multiTier.keys()] } },
    orderBy: { createdAt: 'asc' },
  })
  const userIds = [...new Set(legacyLocks.map((lock) => lock.userId))]
  const orders = userIds.length
    ? await prisma.order.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, currency: true, items: { select: { productId: true, tierLabel: true, price: true } } },
      })
    : []

  const ordersByUser = new Map()
  for (const order of orders) {
    const list = ordersByUser.get(order.userId) || []
    list.push(order)
    ordersByUser.set(order.userId, list)
  }

  let convertedRows = 0
  let createdTierLocks = 0
  let unresolvedRows = 0

  for (const lock of legacyLocks) {
    const family = multiTier.get(lock.productId)
    const userOrders = ordersByUser.get(lock.userId) || []
    const maxBoughtIdr = Math.max(0, ...userOrders.flatMap((order) => (
      order.items.map((item) => toIDR(item.price, order.currency))
    )))
    const purchasedLabels = new Set(
      userOrders.flatMap((order) => order.items)
        .filter((item) => item.productId === lock.productId)
        .map((item) => item.tierLabel),
    )
    const intended = family.tiers.filter((tier, index) => {
      const price = effectiveTierPriceIdr(family.product, tier, index)
      return purchasedLabels.has(tier.label) || (price >= STOCK_OUT_MIN && price <= maxBoughtIdr)
    })

    if (!intended.length) {
      unresolvedRows += 1
      continue
    }
    convertedRows += 1
    createdTierLocks += intended.length
    if (!apply) continue

    await prisma.$transaction(async (tx) => {
      for (const tier of intended) {
        const productId = tierStockKey(lock.productId, tier.label)
        await tx.userProductStock.upsert({
          where: { userId_productId: { userId: lock.userId, productId } },
          create: { userId: lock.userId, productId },
          update: {},
        })
      }
      await tx.userProductStock.delete({ where: { id: lock.id } })
    })
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    legacyRows: legacyLocks.length,
    convertedRows,
    createdTierLocks,
    unresolvedRows,
  }))
} finally {
  await prisma.$disconnect()
}
