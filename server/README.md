# EvolusiAI — Backend API

Express + Prisma + SQLite. Auth Google (verifikasi server-side) + JWT, pesanan, ulasan, kupon, dan panel admin (kelola pesanan + kirim kredensial manual).

## Menjalankan (lokal)

```bash
cd server
npm install
npx prisma generate
npx prisma db push      # buat tabel SQLite (dev.db)
npm run db:seed         # isi 11 produk + 3 kupon
npm run dev             # jalan di http://localhost:4000
```

Lalu jalankan frontend di terminal lain:

```bash
cd app
npm run dev             # http://localhost:5173 (proxy /api → :4000)
```

## Konfigurasi (`server/.env`)

| Variabel | Keterangan |
|---|---|
| `PORT` | Port server (default 4000) |
| `JWT_SECRET` | **Ganti** dengan string acak panjang di produksi |
| `GOOGLE_CLIENT_ID` | Sama dengan frontend (verifikasi credential GSI) |
| `ADMIN_EMAILS` | Email yang otomatis jadi ADMIN (pisahkan koma) |
| `CLIENT_ORIGIN` | Origin frontend untuk CORS |

Login dengan email yang ada di `ADMIN_EMAILS` → otomatis dapat akses **Panel Admin** (`/admin`).

## Endpoint utama

- `POST /api/auth/google` · `GET /api/auth/me`
- `GET /api/products` · `POST /api/coupons/validate`
- `POST /api/orders` (multipart, upload bukti) · `GET /api/orders` · `GET /api/orders/:id`
- `GET /api/reviews/:productId` · `POST /api/reviews`
- Admin: `GET /api/admin/orders` · `PATCH /api/admin/orders/:id` · `POST /api/admin/orders/:id/deliver`

## Keamanan

Sudah diterapkan:
- **Enkripsi at-rest (AES-256-GCM)** untuk data sensitif: `ownPassword` (akun pembeli) serta `credPassword`/`credApiKey` (kredensial terkirim). Disimpan berprefiks `enc:v1:`, didekripsi hanya saat dibaca pihak berwenang. Kunci dari `ENCRYPTION_KEY` (fallback diturunkan dari `JWT_SECRET`).
- **Bukti transaksi tidak publik.** Tidak ada `/uploads` statis; hanya admin (Bearer) yang bisa mengaksesnya lewat `GET /api/admin/orders/:id/proof`.
- Verifikasi Google ID token di server + JWT untuk sesi; route admin dijaga `requireAdmin`; harga pesanan divalidasi ulang di server.

Sebelum produksi:
- Set `ENCRYPTION_KEY` & `JWT_SECRET` ke nilai acak rahasia (jangan pakai default repo).
- Batasi `CLIENT_ORIGIN` (CORS) ke domain aslimu & jalankan di HTTPS.
- Gunakan Postgres (ganti `provider` di `schema.prisma`) dan rotasi kunci bila perlu.
