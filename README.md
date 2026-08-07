# Upbit Store

Marketplace produk digital (akun & langganan AI premium) — React + Vite (frontend) & Express + Prisma + Postgres (backend) dalam satu repo, siap deploy ke Vercel.

- **Frontend:** `app/` (React 18, Vite, multi-bahasa, 3 mata uang IDR/USD/CNY)
- **Backend:** `server/` (Express, Prisma, Neon Postgres, JWT, Vercel Blob)
- **Entry serverless Vercel:** `api/index.js`

## Jalankan lokal

```bash
npm run install:all     # install semua dependency
npm run db:setup        # buat tabel + seed produk & ulasan (butuh DATABASE_URL Neon di server/.env)
npm run dev             # http://localhost:5173 (web) + :4000 (api)
```

Salin `server/.env.example` → `server/.env` dan `app/.env.example` → `app/.env`, lalu isi nilainya.

## Deploy

Panduan lengkap ke Vercel (Neon Postgres + Vercel Blob) ada di **[DEPLOY.md](DEPLOY.md)**.
