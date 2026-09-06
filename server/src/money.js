// Konversi mata uang. Aturan konsisten di seluruh server:
//   - User.balance & BalanceTransaction.amount SELALU dalam IDR (Rupiah).
//   - Order.total/subtotal/discount & OrderItem.price dalam mata uang pesanan:
//       IDR = rupiah penuh, USD = sen (cents), CNY = fen.
// Kurs pasar perkiraan (Sep 2026): 1 USD ≈ Rp 17.650; 1 USD ≈ ¥6,72; 1 MYR ≈ Rp 4.370.
// Harga USD/CNY/MYR entitas diturunkan dari harga Rp (sumber asli) memakai kurs ini.
export const USD_TO_IDR = 17650
export const USD_TO_CNY = 6.72
export const MYR_RATE = 4370   // 1 MYR ≈ Rp 4.370

// Mata uang pesanan → IDR rupiah.
export function toIDR(amount, currency) {
  const n = amount || 0
  if (currency === 'USD') return Math.round((n / 100) * USD_TO_IDR)
  if (currency === 'CNY') return Math.round((n / 100 / USD_TO_CNY) * USD_TO_IDR)
  if (currency === 'MYR') return Math.round((n / 100) * MYR_RATE)
  return Math.round(n) // IDR
}

// IDR rupiah → mata uang pesanan.
export function fromIDR(idr, currency) {
  const n = idr || 0
  if (currency === 'USD') return Math.round((n * 100) / USD_TO_IDR)
  if (currency === 'CNY') return Math.round((n * USD_TO_CNY * 100) / USD_TO_IDR)
  if (currency === 'MYR') return Math.round((n * 100) / MYR_RATE)
  return Math.round(n) // IDR
}
