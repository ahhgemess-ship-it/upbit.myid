import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { api } from '../api.js'
import { products as staticProducts, splitCatalog } from '../data/products.js'
import { useAuth } from './AuthContext.jsx'
import { useBalance } from './BalanceContext.jsx'

// Katalog dari database (sumber tunggal). Memakai katalog statis sebagai
// tampilan awal/fallback supaya halaman langsung terisi & tetap jalan bila
// backend mati. Begitu /api/products merespons, data DB menimpa.
// Produk multi-durasi tampil SATU kartu — durasi dipilih via dropdown di kartu.
const CatalogContext = createContext(null)

export function CatalogProvider({ children }) {
  const { user } = useAuth()
  const { balance, loaded: balanceLoaded } = useBalance()
  const [products, setProducts] = useState(staticProducts)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const list = await api.products()
      if (Array.isArray(list) && list.length) setProducts(splitCatalog(list)) // identitas — tidak dipecah
    } catch { /* backend mati → pakai fallback statis */ } finally {
      setLoaded(true)
    }
  }, [])

  // Respons checkout membawa daftar tier yang ditutup untuk user aktif.
  // Terapkan setelah animasi pencarian selesai agar urutan visual tetap benar.
  const markProductsStockOut = useCallback((locks = []) => {
    if (!Array.isArray(locks) || !locks.length) return
    setProducts((current) => current.map((product) => {
      const sourceId = product._srcId || product.id
      const tierLabel = product.tiers?.[0]?.label || ''
      const locked = locks.some((lock) => (
        typeof lock === 'string'
          ? lock === product.id || lock === sourceId
          : lock?.productId === sourceId && lock?.tierLabel === tierLabel
      ))
      return locked ? { ...product, stockOut: true, stock: 0 } : product
    }))
  }, [])

  // Muat ulang katalog ketika saldo berubah agar status stok per akun langsung
  // mengikuti top-up, refund, check-in, atau pemakaian saldo.
  useEffect(() => { refresh() }, [refresh, user?.id, balance, balanceLoaded])

  // Terapkan aturan harga <= saldo juga pada katalog awal/fallback, sehingga tidak
  // ada jeda singkat yang menampilkan tombol beli sebelum API selesai merespons.
  // Server tetap menjadi otoritas dan mengulang validasi ini saat checkout.
  const balanceAwareProducts = useMemo(() => products.map((p) => {
    if (!user || !balanceLoaded) return p
    const tiers = Array.isArray(p.tiers) && p.tiers.length
      ? p.tiers
      : [{ label: p.period || 'Produk', price: p.price, priceIntl: p.priceIntl }]
    const pct = p.flashSale ? 0 : Math.max(0, Math.min(90, Number(p.discountPercent) || 0))
    const nextTiers = tiers.map((tier, index) => {
      const base = p.flashSale && index === 0 && Number(p.flashPrice) > 0
        ? Number(p.flashPrice)
        : (Number(tier.price) || Number(p.price) || 0)
      const effectivePrice = Math.round(base * (100 - pct) / 100)
      return { ...tier, balanceStockOut: balance > 0 && effectivePrice > 0 && effectivePrice <= balance }
    })
    return { ...p, tiers: nextTiers, balanceStockOut: nextTiers[0]?.balanceStockOut || false }
  }), [products, user, balance, balanceLoaded])

  const byId = useMemo(() => Object.fromEntries(balanceAwareProducts.map((p) => [p.id, p])), [balanceAwareProducts])
  const getProduct = useCallback((id) => byId[id], [byId])
  // Diskon efektif dengan jadwal — SAMA dengan server (effectiveDiscount):
  // price>0 + sekarang di dalam rentang mulai/berakhir. Tanpa ini FE bisa
  // menampilkan harga diskon yang tidak diizinkan server saat checkout.
  const discountFor = useCallback((id) => {
    const p = byId[id]
    if (!p) return 0
    const pct = Math.max(0, Math.min(90, p.discountPercent || 0))
    if (!pct) return 0
    const now = Date.now()
    if (p.discountStart && now < new Date(p.discountStart).getTime()) return 0
    if (p.discountEnd && now > new Date(p.discountEnd).getTime()) return 0
    return pct
  }, [byId])
  const categories = useMemo(() => [...new Set(balanceAwareProducts.map((p) => p.category))], [balanceAwareProducts])

  const value = useMemo(
    () => ({ products: balanceAwareProducts, getProduct, discountFor, categories, loaded, refresh, markProductsStockOut }),
    [balanceAwareProducts, getProduct, discountFor, categories, loaded, refresh, markProductsStockOut],
  )
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog must be used within CatalogProvider')
  return ctx
}

// Kompat: komponen lama yang pakai useDiscount tetap berjalan.
export function useDiscount() {
  const { discountFor, refresh } = useCatalog()
  return { discountFor, refresh }
}
