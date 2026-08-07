// Google OAuth Client ID.
// Untuk login Google NYATA:
//   1. Buka https://console.cloud.google.com/apis/credentials
//   2. Buat "OAuth 2.0 Client ID" tipe "Web application"
//   3. Tambahkan Authorized JavaScript origin: http://localhost:5173 (dan domain produksimu)
//   4. Salin Client ID ke sini (atau set VITE_GOOGLE_CLIENT_ID di file .env)
//
// Jika dikosongkan, tombol Google berjalan dalam mode contoh (akun contoh, tanpa
// memanggil Google) sehingga alur tetap bisa dicoba tanpa konfigurasi.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export const GOOGLE_ENABLED = Boolean(GOOGLE_CLIENT_ID)

// Base URL API backend. Kosong = pakai proxy Vite (/api → server :4000).
export const API_BASE = import.meta.env.VITE_API_BASE || ''
