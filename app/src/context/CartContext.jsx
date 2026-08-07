import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'

const CartContext = createContext(null)

const CART_KEY = 'upbit_cart'
const readCart = () => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart)

  // Persist keranjang agar tidak hilang saat refresh / pindah ke checkout.
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
  }, [items])

  const addItem = useCallback((product, tier) => {
    const chosen = tier || product.tiers[0]
    const key = `${product.id}__${chosen.label}`
    setItems((prev) => {
      const found = prev.find((i) => i.key === key)
      if (found) {
        return prev.map((i) =>
          i.key === key ? { ...i, qty: i.qty + 1 } : i,
        )
      }
      return [
        ...prev,
        {
          key,
          id: product.id,
          name: product.name,
          vendor: product.vendor,
          logo: product.logo,
          brand: product.brand,
          tierLabel: chosen.label,
          price: chosen.price,
          original: chosen.original || chosen.price,
          priceIntl: chosen.priceIntl ?? chosen.price,
          originalIntl: chosen.originalIntl ?? chosen.priceIntl ?? chosen.price,
          qty: 1,
        },
      ]
    })
  }, [])

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }, [])

  const updateQty = useCallback((key, delta) => {
    setItems((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, qty: Math.min(99, i.qty + delta) } : i))
        .filter((i) => i.qty > 0),
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items])
  const total = useMemo(
    () => items.reduce((s, i) => s + i.qty * i.price, 0),
    [items],
  )

  const value = { items, addItem, removeItem, updateQty, clear, count, total }
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
