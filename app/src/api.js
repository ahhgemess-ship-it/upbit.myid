// Klien API EvolusiAI. Token JWT disimpan di localStorage & dikirim sebagai Bearer.
// Saat backend tidak tersedia, otomatis fallback ke API lokal (data + localStorage).
import { API_BASE } from './config.js'
import { demoApi } from './api-demo.js'

const TOKEN_KEY = 'upbit_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

let demoFallback = false

async function req(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {}
  if (auth) {
    const t = getToken()
    if (t) headers.Authorization = `Bearer ${t}`
  }
  let payload
  if (form) {
    payload = form // FormData — biarkan browser set Content-Type
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload })
  } catch {
    throw new Error('NETWORK')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (!data.error && [500, 502, 503, 504].includes(res.status)) {
      throw new Error('NETWORK')
    }
    throw new Error(data.error || 'Terjadi kesalahan pada server')
  }
  return data
}

// Bungkus api call: coba real API, fallback ke API lokal saat NETWORK error
function withFallback(realFn, demoFn) {
  return async (...args) => {
    if (demoFallback) return demoFn(...args)
    try {
      return await realFn(...args)
    } catch (e) {
      if (e.message === 'NETWORK') {
        demoFallback = true
        return demoFn(...args)
      }
      throw e
    }
  }
}

// Real API calls (pakai server)
const _real = {
  googleLogin: (credential) => req('/api/auth/google', { method: 'POST', body: { credential }, auth: false }),
  me: () => req('/api/auth/me'),
  products: () => req('/api/products', { auth: false }),
  validateCoupon: (code, subtotal) => req('/api/coupons/validate', { method: 'POST', body: { code, subtotal }, auth: false }),
  createOrder: (form) => req('/api/orders', { method: 'POST', form }),
  myOrders: (page = 1) => req(`/api/orders?page=${page}`),
  getOrder: (id) => req(`/api/orders/${id}`),
  requestRefund: (id, reason) => req(`/api/orders/${id}/refund`, { method: 'POST', body: { reason } }),
  notifications: () => req('/api/notifications'),
  notifUnread: () => req('/api/notifications/unread-count'),
  notifReadAll: () => req('/api/notifications/read-all', { method: 'POST' }),
  notifRead: (id) => req(`/api/notifications/${id}/read`, { method: 'POST' }),
  reviews: (productId) => req(`/api/reviews/${productId}`, { auth: false }),
  reviewEligibility: (productId) => req(`/api/reviews/${productId}/eligibility`),
  submitReview: (productId, rating, comment) => req('/api/reviews', { method: 'POST', body: { productId, rating, comment } }),
  adminStats: () => req('/api/admin/stats'),
  adminProducts: () => req('/api/admin/products'),
  adminCreateProduct: (data) => req('/api/admin/products', { method: 'POST', body: data }),
  adminUploadProductImage: (file) => {
    const fd = new FormData()
    fd.append('image', file)
    return req('/api/admin/products/upload', { method: 'POST', form: fd })
  },
  adminUpdateProduct: (id, data) => req(`/api/admin/products/${id}`, { method: 'PATCH', body: data }),
  adminDeleteProduct: (id) => req(`/api/admin/products/${id}`, { method: 'DELETE' }),
  adminCoupons: () => req('/api/admin/coupons'),
  adminCreateCoupon: (data) => req('/api/admin/coupons', { method: 'POST', body: data }),
  adminUpdateCoupon: (code, data) => req(`/api/admin/coupons/${code}`, { method: 'PATCH', body: data }),
  adminDeleteCoupon: (code) => req(`/api/admin/coupons/${code}`, { method: 'DELETE' }),
  adminOrders: (params = '') => req(`/api/admin/orders${params ? `?${params}` : ''}`),
  adminOrder: (id) => req(`/api/admin/orders/${id}`),
  adminUpdate: (id, data) => req(`/api/admin/orders/${id}`, { method: 'PATCH', body: data }),
  adminDeliver: (id, items, complete = true) => req(`/api/admin/orders/${id}/deliver`, { method: 'POST', body: { items, complete } }),
  adminProcessRefund: (id, action, note) => req(`/api/admin/orders/${id}/refund`, { method: 'POST', body: { action, note } }),
  adminProofBlob: async (id) => {
    const t = getToken()
    const res = await fetch(`${API_BASE}/api/admin/orders/${id}/proof`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
    if (!res.ok) throw new Error('Gagal memuat bukti')
    return res.blob()
  },
  // balance
  getBalance: () => req('/api/balance'),
  getBalanceHistory: () => req('/api/balance/history'),
  useBalance: (amount) => req('/api/balance/use', { method: 'POST', body: { amount } }),
  withdrawBalance: (amount, method) => req('/api/balance/withdraw', { method: 'POST', body: { amount, method } }),
  checkInStatus: () => req('/api/balance/checkin/status'),
  checkIn: () => req('/api/balance/checkin', { method: 'POST' }),
  // admin users
  adminUsers: (params = '') => req(`/api/admin/users${params ? `?${params}` : ''}`),
  adminGetUser: (id) => req(`/api/admin/users/${id}`),
  adminUpdateUser: (id, data) => req(`/api/admin/users/${id}`, { method: 'PATCH', body: data }),
  // purchased products (per-user stock)
  purchasedProducts: () => req('/api/products/purchased'),
}

// API publik: auto fallback ke API lokal saat backend mati
export const api = {
  googleLogin: withFallback(_real.googleLogin, demoApi.googleLogin),
  me: withFallback(_real.me, demoApi.me),
  products: withFallback(_real.products, demoApi.products),
  validateCoupon: withFallback(_real.validateCoupon, demoApi.validateCoupon),
  createOrder: withFallback(_real.createOrder, demoApi.createOrder),
  myOrders: withFallback(_real.myOrders, demoApi.myOrders),
  getOrder: withFallback(_real.getOrder, demoApi.getOrder),
  requestRefund: withFallback(_real.requestRefund, demoApi.requestRefund),
  notifications: withFallback(_real.notifications, demoApi.notifications),
  notifUnread: withFallback(_real.notifUnread, demoApi.notifUnread),
  notifReadAll: withFallback(_real.notifReadAll, demoApi.notifReadAll),
  notifRead: withFallback(_real.notifRead, demoApi.notifRead),
  reviews: withFallback(_real.reviews, demoApi.reviews),
  reviewEligibility: withFallback(_real.reviewEligibility, demoApi.reviewEligibility),
  submitReview: withFallback(_real.submitReview, demoApi.submitReview),
  adminStats: withFallback(_real.adminStats, demoApi.adminStats),
  adminProducts: withFallback(_real.adminProducts, demoApi.adminProducts),
  adminCreateProduct: withFallback(_real.adminCreateProduct, demoApi.adminCreateProduct),
  adminUploadProductImage: withFallback(_real.adminUploadProductImage, demoApi.adminUploadProductImage),
  adminUpdateProduct: withFallback(_real.adminUpdateProduct, demoApi.adminUpdateProduct),
  adminDeleteProduct: withFallback(_real.adminDeleteProduct, demoApi.adminDeleteProduct),
  adminCoupons: withFallback(_real.adminCoupons, demoApi.adminCoupons),
  adminCreateCoupon: withFallback(_real.adminCreateCoupon, demoApi.adminCreateCoupon),
  adminUpdateCoupon: withFallback(_real.adminUpdateCoupon, demoApi.adminUpdateCoupon),
  adminDeleteCoupon: withFallback(_real.adminDeleteCoupon, demoApi.adminDeleteCoupon),
  adminOrders: withFallback(_real.adminOrders, demoApi.adminOrders),
  adminOrder: withFallback(_real.adminOrder, demoApi.adminOrder),
  adminUpdate: withFallback(_real.adminUpdate, demoApi.adminUpdate),
  adminDeliver: withFallback(_real.adminDeliver, demoApi.adminDeliver),
  adminProcessRefund: withFallback(_real.adminProcessRefund, demoApi.adminProcessRefund),
  adminProofBlob: withFallback(_real.adminProofBlob, demoApi.adminProofBlob),
  // balance
  getBalance: withFallback(_real.getBalance, demoApi.getBalance),
  getBalanceHistory: withFallback(_real.getBalanceHistory, demoApi.getBalanceHistory),
  useBalance: withFallback(_real.useBalance, demoApi.useBalance),
  withdrawBalance: withFallback(_real.withdrawBalance, demoApi.withdrawBalance),
  checkInStatus: withFallback(_real.checkInStatus, demoApi.checkInStatus),
  checkIn: withFallback(_real.checkIn, demoApi.checkIn),
  adminUsers: withFallback(_real.adminUsers, demoApi.adminUsers),
  adminGetUser: withFallback(_real.adminGetUser, demoApi.adminGetUser),
  adminUpdateUser: withFallback(_real.adminUpdateUser, demoApi.adminUpdateUser),
  purchasedProducts: withFallback(_real.purchasedProducts, demoApi.purchasedProducts),
}
