import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { api } from '../api.js'
import { products as staticProducts } from '../data/products.js'

// Katalog dari database (sumber tunggal). Memakai katalog statis sebagai
// tampilan awal/fallback supaya halaman langsung terisi & tetap jalan bila
// backend mati. Begitu /api/products merespons, data DB menimpa.
const CatalogContext = createContext(null)

export function CatalogProvider({ children }) {
  const [products, setProducts] = useState(staticProducts)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const list = await api.products()
      if (Array.isArray(list) && list.length) setProducts(list)
    } catch { /* backend mati → pakai fallback statis */ } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products])
  const getProduct = useCallback((id) => byId[id], [byId])
  const discountFor = useCallback((id) => byId[id]?.discountPercent || 0, [byId])
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
