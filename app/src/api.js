// Klien API Upbit Store. Sesi utama memakai cookie HttpOnly; token lama hanya
// dipakai satu kali untuk migrasi agar pengguna lama tidak langsung keluar.
import { API_BASE } from './config.js'
import { demoApi } from './api-demo.js'

const TOKEN_KEY = 'upbit_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)(?:__Host-upbit_csrf|upbit_csrf)=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

let fallbackUntil = 0 // timestamp sampai kapan pakai API lokal (auto-pulih setelah 15 detik)

async function req(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {}
  const t = getToken()
  if (t) headers.Authorization = `Bearer ${t}`
  if (!t && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = csrfToken()
    if (csrf) headers['X-CSRF-Token'] = csrf
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
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload, credentials: 'same-origin' })
  } catch {
    throw new Error('NETWORK')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (!data.error && [500, 502, 503, 504].includes(res.status)) {
      throw new Error('NETWORK')
    }
    const error = new Error(data.error || 'Terjadi kesalahan pada server')
    error.code = data.code || ''
    throw error
  }
  return data
}

// Bungkus api call: coba real API, fallback ke API lokal saat NETWORK error.
// Tidak mengunci permanen — setelah 15 detik coba lagi real API agar backend bisa pulih.
function withFallback(realFn, demoFn) {
  return async (...args) => {
    if (Date.now() < fallbackUntil) return demoFn(...args)
    try {
      const data = await realFn(...args)
      fallbackUntil = 0 // backend pulih — reset latch
      return data
    } catch (e) {
      if (e.message === 'NETWORK') {
        fallbackUntil = Date.now() + 15000
        return demoFn(...args)
      }
      throw e
    }
  }
}

// Real API calls (pakai server)
const _real = {
  googleLogin: (credential, deviceFingerprint = '') => req('/api/auth/google', { method: 'POST', body: { credential, deviceFingerprint }, auth: false }),
  passwordRegister: (payload, deviceFingerprint = '') => req('/api/auth/register', { method: 'POST', body: { ...payload, deviceFingerprint }, auth: false }),
  passwordLogin: (identifier, password, deviceFingerprint = '') => req('/api/auth/login', { method: 'POST', body: { identifier, password, deviceFingerprint }, auth: false }),
  me: () => req('/api/auth/me'),
  migrateSession: () => req('/api/auth/session', { method: 'POST' }),
  logout: () => req('/api/auth/logout', { method: 'POST' }),
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
  adminStats: (params = '') => req(`/api/admin/stats${params ? `?${params}` : ''}`),
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
  adminCreateOrder: (payload) => req('/api/admin/orders', { method: 'POST', body: payload }),
  adminEditOrder: (id, data) => req(`/api/admin/orders/${id}`, { method: 'PATCH', body: data }),
  adminDeleteOrder: (id) => req(`/api/admin/orders/${id}`, { method: 'DELETE' }),
  adminDeliver: (id, items, complete = true) => req(`/api/admin/orders/${id}/deliver`, { method: 'POST', body: { items, complete } }),
  adminProcessRefund: (id, action, note) => req(`/api/admin/orders/${id}/refund`, { method: 'POST', body: { action, note } }),
  adminProofBlob: async (id) => {
    const t = getToken()
    const headers = t ? { Authorization: `Bearer ${t}` } : {}
    const res = await fetch(`${API_BASE}/api/admin/orders/${id}/proof`, { headers, credentials: 'same-origin' })
    if (!res.ok) throw new Error('Gagal memuat bukti')
    return res.blob()
  },
  // balance
  getBalance: () => req('/api/balance'),
  getBalanceHistory: () => req('/api/balance/history'),
  checkInStatus: () => req('/api/balance/checkin/status'),
  checkIn: () => req('/api/balance/checkin', { method: 'POST' }),
  // Telegram link (satu dompet dengan bot) — tanpa kode, deep-link dari bot
  telegramStatus: () => req('/api/telegram/status'),
  telegramLink: (telegramId) => req('/api/telegram/link', { method: 'POST', body: { telegramId } }),
  // Top-up saldo (multipart)
  createTopup: (form) => req('/api/balance/topup', { method: 'POST', form }),
  topupHistory: () => req('/api/balance/topup'),
  // Admin: verifikasi top-up
  adminTopups: (params = '') => req(`/api/admin/topups${params}`),
  adminApproveTopup: (id) => req(`/api/admin/topups/${id}/approve`, { method: 'POST', body: {} }),
  adminRejectTopup: (id) => req(`/api/admin/topups/${id}/reject`, { method: 'POST', body: {} }),
  // admin users
  adminUsers: (params = '') => req(`/api/admin/users${params ? `?${params}` : ''}`),
  adminGetUser: (id) => req(`/api/admin/users/${id}`),
  adminUpdateUser: (id, data) => req(`/api/admin/users/${id}`, { method: 'PATCH', body: data }),
  adminReleaseUserDevices: (id) => req(`/api/admin/users/${id}/devices/release`, { method: 'POST', body: {} }),
  adminSetBalance: (id, balance, note) => req(`/api/admin/users/${id}`, { method: 'PATCH', body: { balance, adjustNote: note } }),
  // admin settings (pengaturan global toko)
  adminGetSettings: () => req('/api/admin/settings'),
  adminUpdateSettings: (data) => req('/api/admin/settings', { method: 'PUT', body: data }),
}

// API publik: auto fallback ke API lokal saat backend mati
export const api = {
  googleLogin: _real.googleLogin,
  passwordRegister: _real.passwordRegister,
  passwordLogin: _real.passwordLogin,
  me: _real.me,
  migrateSession: _real.migrateSession,
  logout: _real.logout,
  products: withFallback(_real.products, demoApi.products),
  validateCoupon: withFallback(_real.validateCoupon, demoApi.validateCoupon),
  createOrder: _real.createOrder,
  myOrders: _real.myOrders,
  getOrder: _real.getOrder,
  requestRefund: _real.requestRefund,
  notifications: _real.notifications,
  notifUnread: _real.notifUnread,
  notifReadAll: _real.notifReadAll,
  notifRead: _real.notifRead,
  reviews: withFallback(_real.reviews, demoApi.reviews),
  reviewEligibility: _real.reviewEligibility,
  submitReview: _real.submitReview,
  adminStats: _real.adminStats,
  adminProducts: _real.adminProducts,
  adminCreateProduct: _real.adminCreateProduct,
  adminUploadProductImage: _real.adminUploadProductImage,
  adminUpdateProduct: _real.adminUpdateProduct,
  adminDeleteProduct: _real.adminDeleteProduct,
  adminCoupons: _real.adminCoupons,
  adminCreateCoupon: _real.adminCreateCoupon,
  adminUpdateCoupon: _real.adminUpdateCoupon,
  adminDeleteCoupon: _real.adminDeleteCoupon,
  adminOrders: _real.adminOrders,
  adminOrder: _real.adminOrder,
  adminUpdate: _real.adminUpdate,
  adminCreateOrder: _real.adminCreateOrder,
  adminEditOrder: _real.adminEditOrder,
  adminDeleteOrder: _real.adminDeleteOrder,
  adminDeliver: _real.adminDeliver,
  adminProcessRefund: _real.adminProcessRefund,
  adminProofBlob: _real.adminProofBlob,
  // balance
  getBalance: _real.getBalance,
  getBalanceHistory: _real.getBalanceHistory,
  checkInStatus: _real.checkInStatus,
  checkIn: _real.checkIn,
  // Telegram link (butuh backend)
  telegramStatus: _real.telegramStatus,
  telegramLink: _real.telegramLink,
  // Top-up (butuh backend)
  createTopup: _real.createTopup,
  topupHistory: _real.topupHistory,
  adminTopups: _real.adminTopups,
  adminApproveTopup: _real.adminApproveTopup,
  adminRejectTopup: _real.adminRejectTopup,
  adminUsers: _real.adminUsers,
  adminGetUser: _real.adminGetUser,
  adminUpdateUser: _real.adminUpdateUser,
  adminReleaseUserDevices: _real.adminReleaseUserDevices,
  adminSetBalance: _real.adminSetBalance,
  adminGetSettings: _real.adminGetSettings,
  adminUpdateSettings: _real.adminUpdateSettings,
}
