import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api.js'
import { useAuth } from './AuthContext.jsx'

const PURCHASED_KEY = 'upbit_purchased'

/** Hook: lacak produk yang sudah dibeli per user (dari orders + localStorage fallback). */
export function usePurchased() {
  const { user } = useAuth()
  const [purchasedIds, setPurchasedIds] = useState(() => {
    try {
      const raw = localStorage.getItem(PURCHASED_KEY)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Fetch dari API orders + purchased products (per-user stock-out)
  useEffect(() => {
    if (!user) return
    let on = true
    Promise.all([
      api.myOrders(1),
      api.purchasedProducts().catch(() => ({ ids: [] })),
    ])
      .then(([ordersData, purchasedData]) => {
        if (!on) return
        const orders = ordersData.orders || []
        const ids = new Set()
        for (const o of orders) {
          for (const it of o.items || []) {
            if (it.productId) ids.add(it.productId)
          }
        }
        // Gabung dari API purchased (UserProductStock) + localStorage
        if (purchasedData.ids) for (const id of purchasedData.ids) ids.add(id)
        try {
          const local = JSON.parse(localStorage.getItem(PURCHASED_KEY) || '[]')
          for (const id of local) ids.add(id)
        } catch {}
        setPurchasedIds(ids)
        localStorage.setItem(PURCHASED_KEY, JSON.stringify([...ids]))
      })
      .catch(() => {
        try {
          const local = JSON.parse(localStorage.getItem(PURCHASED_KEY) || '[]')
          if (local.length) setPurchasedIds(new Set(local))
        } catch {}
      })
    return () => { on = false }
  }, [user])

  const isPurchased = useCallback(
    (productId) => purchasedIds.has(productId),
    [purchasedIds],
  )

  const markPurchased = useCallback((productId) => {
    setPurchasedIds((prev) => {
      const next = new Set(prev)
      next.add(productId)
      localStorage.setItem(PURCHASED_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  return useMemo(() => ({ isPurchased, markPurchased, purchasedIds }), [isPurchased, markPurchased, purchasedIds])
}
