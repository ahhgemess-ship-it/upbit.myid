import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api dan /uploads ke server Express (port 4000) saat development.
export default defineConfig({
  plugins: [react()],
  server: {
    // Port dikunci: Google OAuth hanya mengizinkan origin http://localhost:5173.
    // Tanpa strictPort, Vite diam-diam pindah ke 5174 jika 5173 dipakai → login Google gagal.
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/uploads': 'http://localhost:4000',
    },
  },
})
