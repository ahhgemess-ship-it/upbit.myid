export const LOW_PRICE_STOCK_THRESHOLD = 100_000

export function publicStockRange(priceIdr) {
  const price = Math.max(0, Number(priceIdr) || 0)
  return price < LOW_PRICE_STOCK_THRESHOLD
    ? { min: 2, max: 5 }
    : { min: 3, max: 18 }
}

export function randomPublicStock(priceIdr, random = Math.random) {
  const { min, max } = publicStockRange(priceIdr)
  const roll = Math.min(0.999999999, Math.max(0, Number(random()) || 0))
  return min + Math.floor(roll * (max - min + 1))
}
