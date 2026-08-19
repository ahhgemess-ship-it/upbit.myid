// Konversi mata uang. Aturan konsisten di seluruh server:
//   - User.balance & BalanceTransaction.amount SELALU dalam IDR (Rupiah).
//   - Order.total/subtotal/discount & OrderItem.price dalam mata uang pesanan:
//       IDR = rupiah penuh, USD = sen (cents), CNY = fen.
export const USD_TO_IDR = 16300 // 1 USD ≈ Rp 16.300
export const USD_TO_CNY = 7.2 // 1 USD ≈ 7,2 Yuan

// Mata uang pesanan → IDR rupiah.
export function toIDR(amount, currency) {
  const n = amount || 0
  if (currency === 'USD') return Math.round((n / 100) * USD_TO_IDR)
  if (currency === 'CNY') return Math.round((n / 100 / USD_TO_CNY) * USD_TO_IDR)
  return Math.round(n) // IDR
}

// IDR rupiah → mata uang pesanan.
export function fromIDR(idr, currency) {
  const n = idr || 0
  if (currency === 'USD') return Math.round((n * 100) / USD_TO_IDR)
  if (currency === 'CNY') return Math.round((n * USD_TO_CNY * 100) / USD_TO_IDR)
  return Math.round(n) // IDR
}
