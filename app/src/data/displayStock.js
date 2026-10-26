const hashId = (value) => {
  const text = String(value || '')
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export const displayStockRange = (priceIdr) => (
  Number(priceIdr) < 100_000
    ? { min: 2, max: 5 }
    : { min: 3, max: 18 }
)

export function remainingDisplayStock({ id, priceIdr, stock, unavailable = false }) {
  if (unavailable) return 0
  if (Number.isFinite(stock) && stock >= 0) return stock
  const { min, max } = displayStockRange(priceIdr)
  return min + (hashId(id) % (max - min + 1))
}
