// API cadangan — berjalan tanpa backend server.
// Digunakan saat backend tidak tersedia (API 500 / network error).
// Semua data diambil dari static products.js, order & review disimpan di localStorage.

import { products, flashSale, getSaleEndTime } from './data/products.js'

const ORDER_KEY = 'demo_orders'
const REVIEW_KEY = 'demo_reviews'

// ========= helpers =========
const uid = () => `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const load = (key) => { try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] } }
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data))

// ========= produk =========
function productsList() {
  return products
}

// ========= kupon =========
function validateCoupon(code, subtotal) {
  // Kode sama dengan backend asli: "UPBIT10" diskon 10%, "NEWBIE" diskon 15%
  if (code === 'UPBIT10') return { code: 'UPBIT10', discount: Math.round(subtotal * 0.1), label: 'Diskon 10%', type: 'percent' }
  if (code === 'NEWBIE') return { code: 'NEWBIE', discount: Math.round(subtotal * 0.15), label: 'Diskon 15% pengguna baru', type: 'percent' }
  throw new Error('Kode kupon tidak valid')
}

// ========= order =========
function createOrder({ items, deliveryEmail, method, currency, activation, ownEmail, ownPassword, couponCode, txHash }) {
  const order = {
    id: uid(),
    items: JSON.parse(items).map(i => ({ ...i, id: i.id })),
    deliveryEmail,
    method,
    currency,
    activation,
    ownEmail: ownEmail || null,
    txHash: txHash || null,
    couponCode: couponCode || null,
    status: 'processing',
    createdAt: new Date().toISOString(),
    total: 0,
  }
  const orders = load(ORDER_KEY)
  orders.unshift(order)
  save(ORDER_KEY, orders)
  return order
}

function getOrders(page = 1) {
  const orders = load(ORDER_KEY)
  return { orders, total: orders.length, page, pages: 1 }
}

function getOrder(id) {
  const orders = load(ORDER_KEY)
  const o = orders.find(o => o.id === id)
  if (!o) throw new Error('Pesanan tidak ditemukan')
  return { order: o }
}

// ========= review =========
function getReviews(productId) {
  const reviews = load(REVIEW_KEY)
  return reviews.filter(r => r.productId === productId)
}

function submitReview(productId, rating, comment) {
  const reviews = load(REVIEW_KEY)
  const review = {
    id: uid(),
    productId,
    rating,
    comment,
    userName: 'Guest',
    createdAt: new Date().toISOString(),
  }
  reviews.unshift(review)
  save(REVIEW_KEY, reviews)
  return review
}

function reviewEligibility(productId) {
  const orders = load(ORDER_KEY)
  const reviews = load(REVIEW_KEY)
  const bought = orders.some(o => o.items.some(i => i.id === productId))
  const reviewed = reviews.some(r => r.productId === productId)
  return { eligible: bought && !reviewed }
}

// ========= export API mirror =========
export const demoApi = {
  // auth — decode credential JWT Google langsung di frontend
  googleLogin: async (credential) => {
    let user = { name: 'User', email: 'user@upbitapps.my.id', role: 'USER', picture: null }
    try {
      // Decode Google credential JWT (payload di tengah)
      const payload = JSON.parse(atob(credential.split('.')[1]))
      if (payload.email) {
        user = {
          name: payload.name || payload.email.split('@')[0],
          email: payload.email,
          role: 'USER',
          picture: payload.picture || null,
        }
      }
    } catch { /* fallback ke default */ }
    const token = 'demo-token-' + Date.now().toString(36)
    // Simpan user asli agar AuthContext boot bisa restore
    localStorage.setItem('upbit_session', JSON.stringify(user))
    return { token, user }
  },
  me: async () => {
    const cached = JSON.parse(localStorage.getItem('upbit_session') || 'null')
    return { user: cached || { name: 'User', email: 'user@upbitapps.my.id', role: 'USER', picture: null } }
  },

  // products
  products: async () => productsList(),

  // coupons
  validateCoupon: async (code, subtotal) => validateCoupon(code, subtotal),

  // orders
  createOrder: async (form) => {
    // form is FormData
    const data = {}
    for (const [k, v] of form.entries()) data[k] = v
    const order = createOrder(data)
    return { order }
  },
  myOrders: async (page) => getOrders(page),
  getOrder: async (id) => getOrder(id),
  requestRefund: async (id, reason) => {
    const orders = load(ORDER_KEY)
    const o = orders.find(o => o.id === id)
    if (!o) throw new Error('Pesanan tidak ditemukan')
    o.refundStatus = 'REQUESTED'
    o.refundReason = reason
    save(ORDER_KEY, orders)
    return { success: true }
  },

  // notifications (kosong)
  notifications: async () => [],
  notifUnread: async () => ({ count: 0 }),
  notifReadAll: async () => ({}),
  notifRead: async () => ({}),

  // reviews
  reviews: async (productId) => getReviews(productId),
  reviewEligibility: async (productId) => reviewEligibility(productId),
  submitReview: async (productId, rating, comment) => {
    const review = submitReview(productId, rating, comment)
    return { review }
  },

  // balance
  getBalance: async () => {
    const balance = parseInt(localStorage.getItem('demo_balance') || '0', 10)
    const orders = load(ORDER_KEY)
    const totalSpent = orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0)
    return {
      balance,
      totalSpent,
      minWithdraw: 250000,
      withdrawEligible: totalSpent >= 250000,
    }
  },
  getBalanceHistory: async () => {
    const raw = localStorage.getItem('demo_balance_history')
    return raw ? JSON.parse(raw) : []
  },
  useBalance: async (amount) => {
    const balance = parseInt(localStorage.getItem('demo_balance') || '0', 10)
    if (balance < amount) throw new Error('Saldo tidak mencukupi')
    const newBalance = balance - amount
    localStorage.setItem('demo_balance', String(newBalance))
    const history = JSON.parse(localStorage.getItem('demo_balance_history') || '[]')
    history.unshift({
      id: uid(), amount: -amount, type: 'purchase', note: `Pembayaran pesanan -Rp ${amount.toLocaleString('id-ID')}`,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('demo_balance_history', JSON.stringify(history.slice(0, 50)))
    return { success: true, balance: newBalance }
  },
  withdrawBalance: async (amount, method) => {
    const balance = parseInt(localStorage.getItem('demo_balance') || '0', 10)
    const orders = load(ORDER_KEY)
    const totalSpent = orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0)
    if (totalSpent < 250000) {
      throw new Error(`Total transaksi minimal Rp 250.000 untuk bisa tarik saldo. Total Anda: Rp ${totalSpent.toLocaleString('id-ID')}`)
    }
    if (balance < amount) throw new Error('Saldo tidak mencukupi')
    const newBalance = balance - amount
    localStorage.setItem('demo_balance', String(newBalance))
    const history = JSON.parse(localStorage.getItem('demo_balance_history') || '[]')
    history.unshift({
      id: uid(), amount: -amount, type: 'withdraw',
      note: `Tarik saldo via ${method || 'manual'} — Rp ${amount.toLocaleString('id-ID')}`,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('demo_balance_history', JSON.stringify(history.slice(0, 50)))
    return { success: true, balance: newBalance, withdrawn: amount }
  },

  // check-in
  checkInStatus: async () => {
    const lastCheckIn = localStorage.getItem('demo_last_checkin')
    const streak = parseInt(localStorage.getItem('demo_checkin_streak') || '0', 10)
    const now = new Date()
    const last = lastCheckIn ? new Date(lastCheckIn) : null
    // Sudah check-in hari ini?
    const alreadyToday = last && last.toDateString() === now.toDateString()
    // Streak lanjut kalau terakhir kemarin
    const nextStreak = alreadyToday ? streak : last && (now - last < 48 * 3600_000) && last.getDate() !== now.getDate() ? streak + 1 : 1
    return {
      streak: alreadyToday ? streak : (last && (now - last < 48 * 3600_000) && last.getDate() !== now.getDate() ? streak : 0),
      canCheckIn: !alreadyToday,
      lastCheckInAt: last?.toISOString() || null,
      cycle: 7,
      reward: 300,
      bonusDay: 7,
      bonus: 2000,
      rewardToday: nextStreak >= 7 ? 2000 : 300,
      nextStreak,
    }
  },
  checkIn: async () => {
    const status = await demoApi.checkInStatus()
    if (!status.canCheckIn) throw new Error('Kamu sudah check-in hari ini. Kembali lagi besok!')
    const reward = status.rewardToday
    const finalStreak = status.nextStreak >= 7 ? 0 : status.nextStreak
    const balance = parseInt(localStorage.getItem('demo_balance') || '0', 10) + reward
    localStorage.setItem('demo_balance', String(balance))
    localStorage.setItem('demo_last_checkin', new Date().toISOString())
    localStorage.setItem('demo_checkin_streak', String(finalStreak))
    const history = JSON.parse(localStorage.getItem('demo_balance_history') || '[]')
    history.unshift({
      id: uid(), amount: reward, type: 'checkin',
      note: status.nextStreak >= 7
        ? `Check-in hari ke-7 — bonus Rp 2.000 🎉`
        : `Check-in harian (hari ke-${status.nextStreak}) — Rp 300`,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem('demo_balance_history', JSON.stringify(history.slice(0, 50)))
    return { success: true, balance, reward, streak: status.nextStreak, newCycle: status.nextStreak >= 7 }
  },

  // admin users (cadangan)
  adminUsers: async (params) => {
    const urlParams = new URLSearchParams(params)
    const q = urlParams.get('q') || ''
    const page = parseInt(urlParams.get('page') || '1', 10)
    // Coba ambil user dari session yang tersimpan
    let users = []
    try {
      const session = JSON.parse(localStorage.getItem('upbit_session') || 'null')
      if (session) {
        users.push({
          id: 'demo-uid-1',
          email: session.email || 'user@upbitapps.my.id',
          name: session.name || 'User',
          picture: session.picture || null,
          role: 'USER',
          balance: parseInt(localStorage.getItem('demo_balance') || '0', 10),
          checkInStreak: parseInt(localStorage.getItem('demo_checkin_streak') || '0', 10),
          lastCheckInAt: localStorage.getItem('demo_last_checkin') || null,
          createdAt: new Date().toISOString(),
          _count: { orders: load(ORDER_KEY).length, balanceTransactions: (JSON.parse(localStorage.getItem('demo_balance_history') || '[]')).length },
        })
      }
    } catch {}
    if (q) users = users.filter(u => u.email.includes(q) || u.name.includes(q))
    return { users, total: users.length, page, pageSize: 20, totalPages: 1 }
  },
  adminGetUser: async (id) => {
    const session = JSON.parse(localStorage.getItem('upbit_session') || 'null')
    const user = {
      id: 'demo-uid-1',
      email: session?.email || 'user@upbitapps.my.id',
      name: session?.name || 'User',
      picture: session?.picture || null,
      role: 'USER',
      balance: parseInt(localStorage.getItem('demo_balance') || '0', 10),
      checkInStreak: parseInt(localStorage.getItem('demo_checkin_streak') || '0', 10),
      lastCheckInAt: localStorage.getItem('demo_last_checkin') || null,
      createdAt: new Date().toISOString(),
    }
    const orders = load(ORDER_KEY)
    const history = JSON.parse(localStorage.getItem('demo_balance_history') || '[]')
    const totalSpent = orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0)
    const refundOrders = orders.filter(o => o.refundStatus && o.refundStatus !== 'NONE')
    return {
      user,
      orders,
      balanceTransactions: history,
      summary: {
        totalSpent,
        totalOrders: orders.length,
        refundCount: refundOrders.length,
        refundApproved: refundOrders.filter(o => o.refundStatus === 'APPROVED').length,
        refundRejected: refundOrders.filter(o => o.refundStatus === 'REJECTED').length,
        refundPending: refundOrders.filter(o => o.refundStatus === 'REQUESTED').length,
      },
    }
  },
  adminUpdateUser: async (id, data) => {
    if (data.balanceAdjust) {
      const adjust = parseInt(data.balanceAdjust, 10)
      const balance = parseInt(localStorage.getItem('demo_balance') || '0', 10) + adjust
      localStorage.setItem('demo_balance', String(balance))
      const history = JSON.parse(localStorage.getItem('demo_balance_history') || '[]')
      history.unshift({
        id: uid(), amount: adjust, type: adjust > 0 ? 'refund' : 'purchase',
        note: data.adjustNote || `Admin ${adjust > 0 ? 'menambah' : 'mengurangi'} saldo Rp ${Math.abs(adjust).toLocaleString('id-ID')}`,
        createdAt: new Date().toISOString(),
      })
      localStorage.setItem('demo_balance_history', JSON.stringify(history.slice(0, 50)))
    }
    return {
      user: {
        id: 'demo-uid-1',
        email: 'user@upbitapps.my.id',
        name: data.name || 'User',
        role: data.role || 'USER',
        balance: parseInt(localStorage.getItem('demo_balance') || '0', 10),
        checkInStreak: parseInt(localStorage.getItem('demo_checkin_streak') || '0', 10),
      },
    }
  },

  // admin
  adminStats: async () => ({ totalOrders: load(ORDER_KEY).length, totalUsers: 1 }),
  adminProducts: async () => productsList(),
  adminOrders: async () => {
    const orders = load(ORDER_KEY)
    return orders
  },
  adminOrder: async (id) => getOrder(id),
  adminUpdate: async (id, data) => {
    const orders = load(ORDER_KEY)
    const o = orders.find(o => o.id === id)
    if (!o) throw new Error('Pesanan tidak ditemukan')
    Object.assign(o, data)
    save(ORDER_KEY, orders)
    return { order: o }
  },
  adminDeliver: async (id) => {
    const orders = load(ORDER_KEY)
    const o = orders.find(o => o.id === id)
    if (!o) throw new Error('Pesanan tidak ditemukan')
    o.status = 'completed'
    save(ORDER_KEY, orders)
    return { order: o }
  },
  adminProcessRefund: async (id, action) => {
    const orders = load(ORDER_KEY)
    const o = orders.find(o => o.id === id)
    if (!o) throw new Error('Pesanan tidak ditemukan')
    o.refundStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    save(ORDER_KEY, orders)
    return { order: o }
  },
  adminProofBlob: async () => { throw new Error('Tidak tersedia di mode lokal') },
  adminCreateProduct: async () => { throw new Error('Tidak tersedia di mode lokal') },
  adminUploadProductImage: async () => { throw new Error('Tidak tersedia di mode lokal') },
  adminUpdateProduct: async () => { throw new Error('Tidak tersedia di mode lokal') },
  adminDeleteProduct: async () => { throw new Error('Tidak tersedia di mode lokal') },
  purchasedProducts: async () => {
    const raw = localStorage.getItem('upbit_purchased')
    try { return { ids: JSON.parse(raw || '[]') } } catch { return { ids: [] } }
  },
  adminCoupons: async () => [],
  adminCreateCoupon: async () => { throw new Error('Tidak tersedia di mode lokal') },
  adminUpdateCoupon: async () => { throw new Error('Tidak tersedia di mode lokal') },
  adminDeleteCoupon: async () => { throw new Error('Tidak tersedia di mode lokal') },
}
