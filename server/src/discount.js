// Diskon efektif: hormati persen + jadwal mulai/berakhir.
export function effectiveDiscount(product, now = new Date()) {
  const pct = Math.max(0, Math.min(90, product.discountPercent || 0))
  if (!pct) return 0
  if (product.discountStart && now < new Date(product.discountStart)) return 0
  if (product.discountEnd && now > new Date(product.discountEnd)) return 0
  return pct
}

export const salePrice = (price, pct) =>
  pct > 0 ? Math.round((price * (100 - pct)) / 100) : price
