// Harga 4 mata uang berdasarkan bahasa:
//   id  → IDR (Rupiah)     disimpan dalam rupiah penuh (field `price`)
//   zh  → CNY (Yuan)       diturunkan dari USD × kurs (disajikan dalam "sen"/fen)
//   ms  → MYR (Ringgit)    diturunkan dari IDR / kurs (disajikan dalam "sen")
//   lain → USD (Dollar)    disimpan dalam SEN/cents (field `priceIntl`)
import { useLang } from '../context/LanguageContext.jsx'
import { formatIDR } from '../data/products.js'

export const USD_TO_IDR = 16300 // untuk estimasi nominal crypto / konversi pembayaran
export const USD_TO_CNY = 7.2 // 1 USD ≈ 7,2 Yuan
export const MYR_RATE = 3500   // 1 MYR ≈ Rp 3.500, digunakan untuk konversi balik IDR

export const regionForLang = (lang) => (lang === 'id' ? 'ID' : lang === 'zh' ? 'CN' : lang === 'ms' ? 'MY' : 'INTL')
export const currencyForRegion = (region) =>
  region === 'ID' ? 'IDR' : region === 'CN' ? 'CNY' : region === 'MY' ? 'MYR' : 'USD'

export const formatUSD = (cents) =>
  '$' + ((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const formatCNY = (cents) =>
  '¥' + ((cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const formatMYR = (sen) =>
  'RM ' + ((sen || 0) / 100).toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Format jumlah sesuai mata uang.
export const formatPrice = (amount, currency) =>
  currency === 'USD' ? formatUSD(amount) : currency === 'CNY' ? formatCNY(amount) : currency === 'MYR' ? formatMYR(amount) : formatIDR(amount || 0)

// Ambil harga sebuah tier/produk untuk region tertentu.
// Objek memiliki `price` (IDR) dan `priceIntl` (USD sen). Yuan diturunkan dari USD.
export const amountFor = (obj, region) => {
  if (region === 'ID') return obj?.price ?? 0
  const usdCents = obj?.priceIntl ?? obj?.price ?? 0 // fallback untuk item keranjang lama
  if (region === 'CN') return Math.round(usdCents * USD_TO_CNY)
  if (region === 'MY') return Math.round(((obj?.price ?? 0) / MYR_RATE) * 100) // IDR → MYR sen
  return usdCents // INTL (USD)
}

// Hook: pricing aktif berdasarkan bahasa saat ini.
export function usePricing() {
  const { lang } = useLang()
  const region = regionForLang(lang)
  const currency = currencyForRegion(region)
  return {
    region,
    currency,
    fmt: (amount) => formatPrice(amount, currency),
    fmtIn: (amount, cur) => formatPrice(amount, cur || currency),
    amountOf: (obj) => amountFor(obj, region),
  }
}
