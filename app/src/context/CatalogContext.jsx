import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { api } from '../api.js'
import { products as staticProducts, splitCatalog } from '../data/products.js'

// Katalog dari database (sumber tunggal). Memakai katalog statis sebagai
// tampilan awal/fallback supaya halaman langsung terisi & tetap jalan bila
// backend mati. Begitu /api/products merespons, data DB menimpa.
// Produk multi-durasi tampil SATU kartu — durasi dipilih via dropdown di kartu.
const CatalogContext = createContext(null)

export function CatalogProvider({ children }) {
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

  useEffect(() => { refresh() }, [refresh])

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
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
  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products])

  const value = useMemo(
    () => ({ products, getProduct, discountFor, categories, loaded, refresh }),
    [products, getProduct, discountFor, categories, loaded, refresh],
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
