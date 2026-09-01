import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api.js'
import { useAuth } from './AuthContext.jsx'

const LEGACY_KEY = 'upbit_purchased'
const keyFor = (uid) => (uid ? `upbit_purchased_${uid}` : null)

// Key localStorage harus PER-USER: user B di browser yang sama tidak boleh
// mewarisi tanda "stok habis" milik user A. Key lama (tanpa user) hanya
// dipakai sekali sebagai migrasi untuk user pertama yang login.
const readLocal = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

const writeLocal = (key, ids) => {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]))
  } catch { /* ignore quota */ }
}

/** Hook: lacak produk yang sudah dibeli per user (dari orders + localStorage per-user). */
export function usePurchased() {
  const { user } = useAuth()
  const uid = user?.id || null
  const storageKey = keyFor(uid)
  const [purchasedIds, setPurchasedIds] = useState(new Set())

  useEffect(() => {
    let on = true
    // Logout / belum login → kosong (tidak mewarisi user lain)
    if (!user) {
      setPurchasedIds(new Set())
      return () => { on = false }
    }
    const key = keyFor(user.id)

    // Migrasi sekali: key lama tanpa user → key user ini, lalu hapus key lama.
    try {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (legacy) {
        const ids = JSON.parse(legacy)
        if (Array.isArray(ids) && ids.length && !localStorage.getItem(key)) {
          localStorage.setItem(key, JSON.stringify(ids))
        }
        localStorage.removeItem(LEGACY_KEY)
      }
    } catch { /* ignore */ }

    const load = async () => {
      // Gabung dari API orders + UserProductStock (sumber kebenaran per-user)
      const ids = readLocal(key)
      try {
        const [ordersData, purchasedData] = await Promise.all([
          api.myOrders(1),
          api.purchasedProducts().catch(() => ({ ids: [] })),
        ])
        if (!on) return
        if (ordersData?.orders?.length) {
          for (const o of ordersData.orders) {
            for (const it of o.items || []) {
              if (it.productId) ids.add(it.productId)
            }
          }
        }
        if (purchasedData.ids?.length) {
          for (const id of purchasedData.ids) ids.add(id)
        }
      } catch { /* tetap pakai cache lokal */ }
      if (!on) return
      setPurchasedIds(ids)
      writeLocal(key, ids)
    }
    load()
    return () => { on = false }
  }, [user])

  const isPurchased = useCallback(
    (productId) => purchasedIds.has(productId),
    [purchasedIds],
  )

  const markPurchased = useCallback((productId) => {
    if (!storageKey) return // tanpa login tidak usah ditandai
    setPurchasedIds((prev) => {
      const next = new Set(prev)
      next.add(productId)
      writeLocal(storageKey, next)
      return next
    })
  }, [storageKey])

  return useMemo(() => ({ isPurchased, markPurchased, purchasedIds }), [isPurchased, markPurchased, purchasedIds])
}