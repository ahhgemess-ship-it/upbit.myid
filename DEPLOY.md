# Upbit Store — Deploy ke Vercel (Neon Postgres + Vercel Blob)

Repo: `app/` (React+Vite) + `server/` (Express+Prisma) + `api/index.js` (entry serverless) dalam satu repo.

Kode **sudah disiapkan** untuk Vercel:
- Database → **Postgres** (`schema.prisma` provider `postgresql`, `DATABASE_URL` + `DIRECT_URL`).
- Upload (bukti bayar QRIS + gambar produk) → **Vercel Blob** di produksi, otomatis pakai disk saat lokal.
- `prisma generate` jalan otomatis saat install (`postinstall` di root).
- Pengacak rating → **Vercel Cron** tiap jam (`vercel.json` → `crons`).
- Secret wajib di produksi (boot ditolak bila `JWT_SECRET` kosong).

---

## 1) Buat database Neon (gratis)

1. Daftar di https://neon.tech → **Create project**.
2. Buka **Connection string** → ambil DUA URL:
   - **Pooled** (host mengandung `-pooler`) → untuk `DATABASE_URL`.
   - **Direct** (tanpa `-pooler`) → untuk `DIRECT_URL`.
   Keduanya diakhiri `?sslmode=require`.

## 2) Setup lokal (sekarang pakai Neon, bukan SQLite lagi)

1. `cp server/.env.example server/.env` lalu isi:
   ```
   DATABASE_URL="<pooled neon url>"
   DIRECT_URL="<direct neon url>"
   JWT_SECRET="<string acak panjang>"
   ENCRYPTION_KEY="<64 hex>"            # opsional
   GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
   ADMIN_EMAILS="ikhwanda466@gmail.com"
   ```
   Contoh secret siap pakai (boleh diganti):
   - `JWT_SECRET` = `peTgGqQVXRVitPNlA9xo_WbvJfwrynCQW8iOp7RWNhKaIPkBdWNfHz56LtWMMPSH`
   - `ENCRYPTION_KEY` = `c54505b90dc6652fa40437e918e3179f977ab91aab8e6e9fd2e74ae8cbdfe12c`
2. `cp app/.env.example app/.env` lalu isi `VITE_GOOGLE_CLIENT_ID`.
3. Install + buat tabel + isi data:
   ```bash
   npm run install:all
   npm run db:setup      # prisma db push + seed produk (43) + seed ulasan
   npm run dev           # cek http://localhost:5173
   ```
   > Lokal tetap pakai disk untuk upload (tanpa `BLOB_READ_WRITE_TOKEN`).

## 3) Push ke GitHub

```bash
git init && git add -A && git commit -m "Upbit Store: siap deploy (Postgres + Blob)"
git branch -M main
git remote add origin https://github.com/USERNAME/upbit-store.git
git push -u origin main
```

## 4) Import & set env di Vercel

1. https://vercel.com → **Add New → Project** → import repo GitHub. Framework: **Other** (vercel.json sudah mengatur build).
2. **Storage → Connect Database → Blob** (buat Blob store). Vercel otomatis menambah env `BLOB_READ_WRITE_TOKEN`.
3. **Settings → Environment Variables** (Production + Preview), isi:
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | pooled Neon url |
   | `DIRECT_URL` | direct Neon url |
   | `JWT_SECRET` | string acak |
   | `ENCRYPTION_KEY` | 64 hex (opsional) |
   | `GOOGLE_CLIENT_ID` | client id Google |
   | `ADMIN_EMAILS` | email admin |
   | `CLIENT_ORIGIN` | `https://NAMA.vercel.app` |
   | `VITE_GOOGLE_CLIENT_ID` | client id Google (untuk frontend) |
   | `CRON_SECRET` | string acak (opsional, amankan cron) |
   *(`BLOB_READ_WRITE_TOKEN` sudah otomatis dari langkah Blob.)*
4. **Deploy.**

## 5) Setelah deploy

1. **Google OAuth**: di Google Cloud Console → Credentials → OAuth Client → **Authorized JavaScript origins** tambahkan `https://NAMA.vercel.app`.
2. **Buka situs**, login Google (email admin) → `/admin` jalan.
3. Database produksi sudah terisi karena `db:setup` (langkah 2) menulis ke Neon yang **sama** dengan produksi. Kalau pakai DB Neon berbeda untuk produksi, jalankan `npm run db:setup` sekali dengan `DATABASE_URL` produksi.

## Catatan

- **Cron pengacak rating**: di plan **Vercel Hobby**, cron praktis hanya jalan ~1×/hari (bukan tiap jam). Untuk benar-benar tiap jam tanpa upgrade Pro, pakai cron eksternal gratis (mis. https://cron-job.org) yang memanggil `https://NAMA.vercel.app/api/cron/shuffle-ratings` tiap jam dengan header `Authorization: Bearer <CRON_SECRET>`.
- **Bukti bayar**: di Blob URL-nya acak/tak tertebak dan hanya bisa dilihat lewat route admin terotentikasi.
- **Lokal vs produksi**: satu provider (Postgres). Untuk lokal kamu bisa pakai DB Neon yang sama atau Neon project terpisah untuk testing.
