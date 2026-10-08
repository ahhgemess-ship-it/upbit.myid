// ═══════════════════════════════════════════════════════════════════
// BOT TELEGRAM EVOLUSIAI — versi serverless (webhook, tanpa VPS)
// Satu dompet dengan website: saldo, check-in, order = database Neon.
// State percakapan disimpan di tabel TelegramState (serverless tanpa memori).
// SetWebhook:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://evolusiai.xyz/api/telegram/webhook"
// Env: TELEGRAM_BOT_TOKEN=...  (atau BOT_TOKEN untuk kompatibilitas bot lama)
// ═══════════════════════════════════════════════════════════════════
import crypto from 'node:crypto'
import { prisma } from './db.js'
import { PAYMENT_FEE_IDR } from './money.js'
import { saveUpload } from './storage.js'
import { notify, notifyAdmins } from './notify.js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ''
const STORE_URL = process.env.CLIENT_ORIGIN || process.env.STORE_URL || 'https://evolusiai.xyz'

// ── Util Telegram Bot API (fire-and-forget; serverless tidak boleh menggantung) ──
// Semua kirim pesan dikumpulkan di `pending` supaya route webhook bisa menunggu
// sampai SEMUA terkirim sebelum membalas 200 — di Vercel serverless, fungsi
// dibekukan begitu respons terkirim, jadi fire-and-forget murni hilang.
const pending = new Set()
// Return true bila terkirim OK, false bila gagal (dipakai untuk fallback foto produk).
async function tg(method, payload) {
  if (!BOT_TOKEN) return false
  const isForm = typeof FormData !== 'undefined' && payload instanceof FormData
  const p = (async () => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: 'POST',
        ...(isForm ? { body: payload } : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        console.error(`tg ${method} gagal:`, j?.description || r.status)
        return false
      }
      return true
    } catch (e) { console.error(`tg ${method} error:`, e?.message || e); return false }
  })()
  pending.add(p)
  p.then(() => pending.delete(p), () => pending.delete(p))
  return p
}
export const flushPending = () => Promise.allSettled([...pending])
const reply = (chatId, text, kb) => tg('sendMessage', {
  chat_id: chatId, text, parse_mode: 'HTML',
  link_preview_options: { is_disabled: true },
  ...(kb ? { reply_markup: kb } : {}),
})
const IK = (inline_keyboard) => ({ inline_keyboard })

// Respon API Telegram yang mengembalikan JSON (untuk getFile, dll.)
async function tgRes(method, payload) {
  if (!BOT_TOKEN) return null
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return await r.json()
  } catch { return null }
}

// ═══ Pembayaran — sumber kebenaran: app/src/data/payment.js (sama persis dgn checkout web) ═══
const QRIS_STATIC =
  '00020101021126570011ID.DANA.WWW011893600915303397767602090339776760303UMI51440014ID.CO.QRIS.WWW0215ID10265685152290303UMI5204599953033605802ID5915EvolusiAi Store6015Kota Jakarta Se6105121106304D121'
function crc16(str) {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}
// QRIS dinamis: sisip nominal (tag 54) + POI 11→12, lalu hitung ulang CRC.
const buildQrisPayload = (amount) => {
  const amt = String(Math.max(0, Math.round(amount || 0)))
  let base = QRIS_STATIC.slice(0, -8)
  base = base.slice(0, 10) + '12' + base.slice(12)
  const field = '54' + String(amt.length).padStart(2, '0') + amt
  base = base.replace('5802ID', field + '5802ID')
  const signed = base + '6304'
  return signed + crc16(signed)
}
const CRYPTO = {
  network: 'BNB Smart Chain (BEP-20)',
  assets: [
    { id: 'bnb', symbol: 'BNB', address: '0x02fd0906c6f873f35259889d7396f46b92a24aee', idrRate: 9650000, decimals: 4 },
    { id: 'usdt', symbol: 'USDT', address: '0x02fd0906c6f873f35259889d7396f46b92a24aee', idrRate: 16300, decimals: 2 },
  ],
}
const toCryptoAmount = (idr, asset) => (idr / asset.idrRate).toFixed(asset.decimals)
const qrImageUrl = (data) => `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(data)}`
function makeBotOrderId() {
  const t = new Date()
  const stamp = String(t.getFullYear()).slice(2) +
    String(t.getMonth() + 1).padStart(2, '0') +
    String(t.getDate()).padStart(2, '0')
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `EVO-${stamp}-${rand}`
}

// ── State percakapan per chat ──
const DEFAULT_STATE = { lang: 'id' }
async function getState(chatId) {
  try {
    const s = await prisma.telegramState.findUnique({ where: { chatId: String(chatId) } })
    if (!s) return { ...DEFAULT_STATE }
    return { ...DEFAULT_STATE, ...JSON.parse(s.data) }
  } catch { return { ...DEFAULT_STATE } }
}
async function setState(chatId, patch) {
  const cur = await getState(chatId)
  const data = { ...cur, ...patch }
  await prisma.telegramState.upsert({
    where: { chatId: String(chatId) },
    create: { chatId: String(chatId), data: JSON.stringify(data) },
    update: { data: JSON.stringify(data) },
  })
  return data
}

// ── i18n ringkas (id default; bahasa lain fallback en/id) ──
const LANGS = {
  id: '🇮🇩 Indonesia', en: '🇬🇧 English', zh: '🇨🇳 中文', ja: '🇯🇵 日本語',
  ru: '🇷🇺 Русский', ms: '🇲🇾 Melayu', hi: '🇮🇳 हिन्दी', de: '🇩🇪 Deutsch', vi: '🇻🇳 Tiếng Việt',
}
const S = {
  welcome: {
    id: '✨ <b>Selamat Datang di EvolusiAI Store!</b>\n━━━━━━━━━━━━━━━━━━\n👤 <b>Tamu (Guest)</b>\n💰 Saldo: <b>Rp 0 (Mode Tamu)</b>\n🔗 Status: <b>Belum Tertaut</b>\n\n🛍️ <i>Jelajahi katalog & flash sale langsung di bawah!</i>\n💡 <i>Tautkan akun website kapan saja untuk sinkronisasi saldo & check-in.</i>\n\nPilih menu di bawah 👇',
    en: '✨ <b>Welcome to EvolusiAI Store!</b>\n━━━━━━━━━━━━━━━━━━\n👤 <b>Guest</b>\n💰 Balance: <b>Rp 0 (Guest Mode)</b>\n🔗 Status: <b>Not Linked</b>\n\n🛍️ <i>Browse products & flash sale below!</i>\n💡 <i>Link your website account anytime to sync balance & check-in.</i>\n\nPick a menu below 👇',
  },
  menuLinked: {
    id: '✨ <b>EvolusiAI Store — Bot Resmi</b>\n━━━━━━━━━━━━━━━━━━\n👤 <b>{name}</b>\n💰 Saldo: <b>{balance}</b>\n🔗 Status: <b>Terhubung ke Website ✅</b>\n\nSilakan pilih menu di bawah untuk berbelanja 👇',
    en: '✨ <b>EvolusiAI Store — Official Bot</b>\n━━━━━━━━━━━━━━━━━━\n👤 <b>{name}</b>\n💰 Balance: <b>{balance}</b>\n🔗 Status: <b>Connected to Website ✅</b>\n\nPick a menu below 👇',
  },
  menuGuest: {
    id: '✨ <b>Selamat Datang di EvolusiAI Store!</b>\n━━━━━━━━━━━━━━━━━━\n👤 <b>Tamu (Guest)</b>\n💰 Saldo: <b>Rp 0 (Mode Tamu)</b>\n🔗 Status: <b>Belum Tertaut</b>\n\n🛍️ <i>Jelajahi katalog & flash sale langsung di bawah!</i>\n💡 <i>Tautkan akun websitemu kapan saja untuk sinkronisasi saldo & check-in.</i>\n\nPilih menu di bawah 👇',
    en: '✨ <b>Welcome to EvolusiAI Store!</b>\n━━━━━━━━━━━━━━━━━━\n👤 <b>Guest</b>\n💰 Balance: <b>Rp 0 (Guest Mode)</b>\n🔗 Status: <b>Not Linked</b>\n\n🛍️ <i>Browse products & flash sale below!</i>\n💡 <i>Link your website account anytime to sync balance & check-in.</i>\n\nPick a menu below 👇',
  },
  menu: {
    id: '✨ <b>EvolusiAI Store</b>\n━━━━━━━━━━━━━━━━━━\n👤 <b>{name}</b>\n💰 Saldo: <b>{balance}</b>\n\nPilih menu di bawah 👇',
    en: '✨ <b>EvolusiAI Store</b>\n━━━━━━━━━━━━━━━━━━\n👤 <b>{name}</b>\n💰 Balance: <b>{balance}</b>\n\nPick a menu below 👇',
  },
  notLinked: {
    id: '🔐 <b>Akun belum terhubung</b>\n\nTekan tombol <b>🔗 Hubungkan Akun Website</b> di bawah ini → kamu dibawa ke website → setelah login, akun otomatis tersambung ke Telegram ini.\n\n✨ Bebas pakai Telegram siapa saja — asal jadi!',
    en: '🔐 <b>Account not linked</b>\n\nTap <b>🔗 Link Website Account</b> below → you will be taken to the website → once logged in, your account connects to this Telegram automatically.\n\n✨ Any Telegram account works!',
  },
  balGuest: {
    id: '💰 <b>Saldo Kamu: Rp 0 (Mode Tamu)</b>\n━━━━━━━━━━━━━━━━━━\nSaldo dompet dan riwayat transaksi kamu tersimpan di akun website.\n\nTautkan akun websitemu untuk melihat saldo & belanja langsung menggunakan saldo!',
    en: '💰 <b>Your Balance: Rp 0 (Guest Mode)</b>\n━━━━━━━━━━━━━━━━━━\nYour wallet balance and transaction history are stored on the website.\n\nLink your website account to view balance & pay using balance!',
  },
  chkGuest: {
    id: '📅 <b>Check-in Harian</b>\n━━━━━━━━━━━━━━━━━━\n🎁 Hadiah Harian: <b>Rp 300 / hari</b>\n🔥 Hari ke-7: Bonus <b>Rp 2.000</b> 🎉\n\n💡 Hubungkan akun website kamu agar reward saldo check-in langsung otomatis masuk ke dompet website!',
    en: '📅 <b>Daily Check-in</b>\n━━━━━━━━━━━━━━━━━━\n🎁 Daily Reward: <b>Rp 300 / day</b>\n🔥 Day 7: Bonus <b>Rp 2,000</b> 🎉\n\n💡 Link your website account so daily check-in rewards are credited to your website wallet!',
  },
  ordGuest: {
    id: '📦 <b>Pesanan Saya</b>\n━━━━━━━━━━━━━━━━━━\nBelum ada pesanan yang tersimpan di Telegram ini.\n\nPesanan dan akun premium tersimpan di akun website. Hubungkan akun websitemu untuk melihat riwayat pesanan di sini!',
    en: '📦 <b>My Orders</b>\n━━━━━━━━━━━━━━━━━━\nNo orders saved on this Telegram.\n\nOrders and premium accounts are saved on your website account. Link your account to view order history here!',
  },
  checkoutGuest: {
    id: '🔐 <b>Hubungkan Akun untuk Memproses Pesanan</b>\n━━━━━━━━━━━━━━━━━━\nUntuk memesan di Telegram, akun website diperlukan agar email pengiriman akses/kredensial terdata aman.\n\nTekan tombol di bawah untuk login & hubungkan akun website dalam 1 klik, atau beli langsung di website:',
    en: '🔐 <b>Link Account to Complete Order</b>\n━━━━━━━━━━━━━━━━━━\nA website account is required so login credentials can be securely delivered to your email.\n\nTap below to link your website account in 1 click, or buy directly on the website:',
  },
  linked: {
    id: '🎉 <b>Akun berhasil terhubung!</b>\n━━━━━━━━━━━━━━━━━━\n👤 {name}\n💰 Saldo: <b>{balance}</b>{migrated}\n\nSelamat bergabung resmi di EvolusiAI Store 🛍️',
    en: '🎉 <b>Account linked successfully!</b>\n━━━━━━━━━━━━━━━━━━\n👤 {name}\n💰 Balance: <b>{balance}</b>{migrated}\n\nWelcome officially to EvolusiAI Store 🛍️',
  },
  migrated: {
    id: '\n🎁 Saldo lama bot <b>{amount}</b> sudah dipindahkan ke akun website kamu.',
    en: '\n🎁 Old bot balance <b>{amount}</b> has been moved to your website account.',
  },
  balance: {
    id: '💰 <b>Saldo kamu</b>\n\nJumlah: <b>{balance}</b>\nTotal belanja: <b>{spent}</b>\nTarik saldo: {eligible}\n\n📡 Real-time dari evolusiai.xyz',
    en: '💰 <b>Your Balance</b>\n\nAmount: <b>{balance}</b>\nTotal spent: <b>{spent}</b>\nWithdraw: {eligible}\n\n📡 Real-time from evolusiai.xyz',
  },
  eligible: { id: '✅ sudah memenuhi syarat', en: '✅ eligible' },
  notEligible: { id: '⏳ belum memenuhi minimal ({min})', en: '⏳ not yet (min {min})' },
  checkinStatus: {
    id: '📅 <b>Check-in Harian</b>\n\nStreak: <b>{streak}</b> hari\nHadiah hari ini: <b>{reward}</b>\n\n{can}\n\n🔥 Hari ke-7 = bonus Rp 2.000 🎉',
    en: '📅 <b>Daily Check-in</b>\n\nStreak: <b>{streak}</b> days\nToday reward: <b>{reward}</b>\n\n{can}\n\n🔥 Day 7 = Rp 2,000 bonus 🎉',
  },
  canCheckin: { id: 'Klik tombol di bawah untuk klaim hari ini 👇', en: 'Tap the button below to claim today 👇' },
  alreadyCheckin: { id: '✅ Sudah check-in hari ini — kembali besok ya!', en: '✅ Already checked in today — see you tomorrow!' },
  checkinOk: {
    id: '🎉 <b>Check-in berhasil!</b>\n\n+{reward} masuk saldo\nStreak: <b>{streak}</b> hari{cycle}\n\nSaldo sekarang: <b>{balance}</b>',
    en: '🎉 <b>Checked in!</b>\n\n+{reward} added to balance\nStreak: <b>{streak}</b> days{cycle}\n\nBalance now: <b>{balance}</b>',
  },
  cycleDone: { id: '\n🏁 Cycle 7 hari selesai — cycle baru dimulai besok!', en: '\n🏁 7-day cycle complete — new cycle starts tomorrow!' },
  ordersHeader: { id: '📦 <b>3 Pesanan Terakhir</b>\n\n', en: '📦 <b>Last 3 Orders</b>\n\n' },
  noOrders: { id: 'Belum ada pesanan.\n\nYuk belanja di evolusiai.xyz ⚡', en: 'No orders yet.\n\nStart shopping at evolusiai.xyz ⚡' },
  statusProcessing: { id: '⏳ Diproses', en: '⏳ Processing' },
  statusCompleted: { id: '✅ Selesai', en: '✅ Completed' },
  statusCancelled: { id: '❌ Dibatalkan', en: '❌ Cancelled' },
  flashHeader: { id: '⚡ <b>FLASH SALE</b> — {n} produk\nHarga real-time dari website:\n\n', en: '⚡ <b>FLASH SALE</b> — {n} products\nLive prices from the website:\n\n' },
  flashLine: { id: '• <b>{name}</b>{dur} — <b>{price}</b> <s>{orig}</s> (-{disc}%)', en: '• <b>{name}</b>{dur} — <b>{price}</b> <s>{orig}</s> (-{disc}%)' },
  empty: { id: 'Belum ada produk flash sale saat ini.', en: 'No flash sale products right now.' },
  langSaved: { id: '✅ Bahasa disimpan: {lang}', en: '✅ Language saved: {lang}' },
  err: { id: '⚠️ Terjadi kesalahan, coba lagi.', en: '⚠️ Something went wrong, try again.' },
  // Notifikasi order (dipakai server, id saja — pesan transaksional)
  notifCreated: { id: '🧾 <b>Pesanan dibuat</b>\n<code>{id}</code>\nTotal: <b>{total}</b>\n\nBayar via QRIS di website ya!' },
  notifCompleted: { id: '✅ <b>Pesanan selesai!</b>\n<code>{id}</code>\n\nAkses sudah dikirim ke email kamu. Cek detail pesanan di website.' },
  notifCancelled: { id: '❌ <b>Pesanan dibatalkan</b>\n<code>{id}</code>\n{refund}\n\nCek Saldoku di website untuk detailnya.' },
  notifRefund: { id: '↩️ <b>Refund masuk ke Saldo</b>\n<code>{id}</code>\n+<b>{amount}</b>' },
  // ── Katalog & beli (id default; bahasa lain fallback ke id) ──
  catalogTitle: { id: '🛍 <b>Katalog</b> — pilih kategori:', en: '🛍 <b>Catalog</b> — pick a category:' },
  catEmpty: { id: 'Belum ada produk aktif.', en: 'No active products yet.' },
  prodPick: { id: '<b>{cat}</b> — {n} produk. Pilih:', en: '<b>{cat}</b> — {n} products. Pick one:' },
  prodDetail: { id: '<b>{name}</b>{out}\n{vendor} · {cat}\n\n<i>{tagline}</i>', en: '<b>{name}</b>{out}\n{vendor} · {cat}\n\n<i>{tagline}</i>' },
  tierPick: { id: 'Pilih paket / durasi:', en: 'Pick package / duration:' },
  outOfStock: { id: '\n⛔ <b>Stok Habis</b> — tidak bisa dibeli sampai restock.', en: '\n⛔ <b>Out of Stock</b> — unavailable until restock.' },
  payTitle: { id: '🧾 <b>Checkout</b>\n{product} · {tier}\nTotal: <b>{total}</b> <i>(sudah termasuk fee {fee})</i>\n\nMetode pembayaran:', en: '🧾 <b>Checkout</b>\n{product} · {tier}\nTotal: <b>{total}</b> <i>(incl. {fee} fee)</i>\n\nPayment method:' },
  payQris: { id: '📲 Scan QR ini untuk bayar <b>{total}</b>.\n\nSetelah transfer, <b>kirim screenshot bukti</b> ke chat ini. Ketik /cancel untuk batal.', en: '📲 Scan this QR to pay <b>{total}</b>.\n\nAfter transfer, <b>send the payment screenshot</b> to this chat. Type /cancel to abort.' },
  payCrypto: { id: '🪙 Kirim <b>{amount} {symbol}</b> ke:\n<code>{address}</code>\nNetwork: <b>{network}</b>\n\nSetelah transfer, <b>balas chat ini dengan TX Hash</b>. Ketik /cancel untuk batal.', en: '🪙 Send <b>{amount} {symbol}</b> to:\n<code>{address}</code>\nNetwork: <b>{network}</b>\n\nAfter transfer, <b>reply with the TX Hash</b>. Type /cancel to abort.' },
  payBalShort: { id: '⚠️ Saldo tidak cukup ({balance}). Top up dulu: evolusiai.xyz/balance', en: '⚠️ Insufficient balance ({balance}). Top up first: evolusiai.xyz/balance' },
  proofGot: { id: '📸 Bukti diterima — membuat pesanan…', en: '📸 Proof received — creating order…' },
  proofFail: { id: '⚠️ Gagal memproses foto. Coba kirim ulang.', en: '⚠️ Failed to process the photo. Please resend.' },
  txShort: { id: '⚠️ TX Hash terlalu pendek (min. 10 karakter).', en: '⚠️ TX Hash too short (min. 10 chars).' },
  txGot: { id: '🔗 TX Hash diterima — membuat pesanan…', en: '🔗 TX Hash received — creating order…' },
  txDup: { id: '⚠️ TX Hash ini sudah pernah dipakai pesanan lain.', en: '⚠️ This TX Hash was already used by another order.' },
  orderMade: { id: '🧾 <b>Pesanan dibuat!</b>\nID: <code>{id}</code>\n{items}\nTotal: <b>{total}</b>\n\n⏳ Status: Diproses — akses dikirim ke email <b>{email}</b> setelah pembayaran diverifikasi admin.', en: '🧾 <b>Order created!</b>\nID: <code>{id}</code>\n{items}\nTotal: <b>{total}</b>\n\n⏳ Status: Processing — access will be emailed to <b>{email}</b> after admin verifies payment.' },
  buyCancel: { id: '❌ Checkout dibatalkan.', en: '❌ Checkout cancelled.' },
  tierGone: { id: '⚠️ Produk/paket tidak ditemukan — buka katalog lagi.', en: '⚠️ Product/tier not found — open the catalog again.' },
  catBack: { id: '« Kategori', en: '« Categories' },
  more: { id: 'Lagi →', en: 'More →' },
  back: { id: '« Kembali', en: '« Back' },
}
const s_ = (key, lang, vars = {}) => {
  let text = S[key]?.[lang] ?? S[key]?.id ?? ''
  for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v))
  return text
}
const rp = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID')
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const statusLine = (status, lang) =>
  status === 'COMPLETED' ? s_('statusCompleted', lang)
  : status === 'CANCELLED' ? s_('statusCancelled', lang)
  : s_('statusProcessing', lang)

// ── Ambil user website dari telegramId ──
async function userByTelegram(telegramId) {
  if (!telegramId) return null
  return prisma.user.findFirst({
    where: { telegramId: String(telegramId), blocked: false },
  })
}

// ── Kartu ringkas (saldo + total belanja) ──
async function spendOf(userId) {
  const orders = await prisma.order.findMany({
    where: { userId, status: 'COMPLETED' },
    select: { total: true, currency: true },
  })
  return orders.reduce((sum, o) => sum + (o.currency === 'IDR' ? o.total : Math.round(o.total * 17650 / 100)), 0)
}
// Min. tarik saldo (Setting global — sama dengan balance.js)
async function minWithdrawGlobal() {
  const s = await prisma.setting.findUnique({ where: { key: 'minWithdraw' } })
  const v = s ? parseInt(s.value, 10) : NaN
  return Number.isSafeInteger(v) && v >= 0 ? v : 310000
}

// ── Menu utama ──
const BANNER_URL = STORE_URL + '/logo.png'
// Peta emoji kategori biar tombol katalog lebih hidup
const CAT_EMOJI = [
  [/ai|asisten|assistant|chatbot/i, '🤖'],
  [/stream|film|movie|tv|video/i, '🎬'],
  [/musik|music|audio|spotify/i, '🎵'],
  [/game|gaming/i, '🎮'],
  [/desain|design|edit|kreatif/i, '🎨'],
  [/vpn|keamanan|security/i, '🛡️'],
  [/edu|kursus|belajar|course/i, '📚'],
]
const catEmoji = (name) => (CAT_EMOJI.find(([re]) => re.test(String(name))) || [null, '🛍️'])[1]
const linkKb = (tgId) => IK([[{ text: '🔗 Hubungkan Akun Website', url: `${STORE_URL}/balance?link=${tgId || ''}` }]])

async function menuFor(user, lang, tgId) {
  const rows = [
    [{ text: '🛍️ Katalog Produk', callback_data: 'm:cat' }, { text: '⚡ Flash Sale', callback_data: 'm:flash' }],
    [{ text: '💰 Saldo Saya', callback_data: 'm:bal' }, { text: '📦 Pesanan Saya', callback_data: 'm:ord' }],
    [{ text: '📅 Check-in Harian', callback_data: 'm:chk' }, { text: '🌐 Bahasa', callback_data: 'm:lang' }],
    [{ text: '⬆️ Top Up Saldo', url: STORE_URL + '/balance' }, { text: '💬 Hubungi CS', url: 'https://t.me/evolusi_store' }],
  ]
  if (user) {
    rows.push([{ text: '🌐 evolusiai.xyz', url: STORE_URL }])
    return { text: s_('menuLinked', lang, { name: esc(user.name), balance: rp(user.balance) }), kb: IK(rows) }
  }
  rows.push([
    { text: '🔗 Hubungkan Akun Web', url: `${STORE_URL}/balance?link=${tgId || ''}` },
    { text: '🌐 evolusiai.xyz', url: STORE_URL },
  ])
  return { text: s_('menuGuest', lang), kb: IK(rows) }
}

// Kirim pesan dengan foto (banner logo, foto produk) — tampilan lebih premium
async function sendBanner(chatId, caption, kb, photoUrl = BANNER_URL) {
  return tg('sendPhoto', {
    chat_id: chatId, photo: photoUrl, caption,
    parse_mode: 'HTML', link_preview_options: { is_disabled: true },
    ...(kb ? { reply_markup: kb } : {}),
  })
}
async function sendStart(chatId, tgId) {
  const user = await userByTelegram(tgId)
  const lang = (await getState(chatId)).lang
  const m = await menuFor(user, lang, tgId)
  return sendBanner(chatId, m.text, m.kb)
}

// Detail produk dengan foto (p.logo): URL https langsung, path '/…' → STORE_URL,
// data-URL base64 (produk kecil di serverless) → unggah multipart. Tanpa logo → teks biasa.
async function sendProductDetail(chatId, p, text, kb) {
  const logo = p.logo || ''
  let photo = null
  let form = null
  if (/^https:\/\//i.test(logo)) {
    photo = logo
  } else if (logo.startsWith('/')) {
    photo = STORE_URL + logo
  } else if (/^data:(image\/[a-z0-9.+-]+);base64,/i.test(logo)) {
    const m = logo.match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i)
    const buf = m ? Buffer.from(m[2], 'base64') : null
    if (buf && buf.length <= 10 * 1024 * 1024) {
      form = new FormData()
      form.append('chat_id', String(chatId))
      form.append('photo', new Blob([buf], { type: m[1] }), `product.${(m[1].split('/')[1] || 'png').replace('jpeg', 'jpg')}`)
      if (kb) form.append('reply_markup', JSON.stringify(kb))
    }
  }
  if (!photo && !form) return reply(chatId, text, kb)
  // Caption foto maks ±1024 UTF-8 — sisakan margin
  if (Buffer.byteLength(text, 'utf8') <= 1000) {
    const ok = photo
      ? await sendBanner(chatId, text, kb, photo)
      : await tg('sendPhoto', (() => { form.append('caption', text); form.append('parse_mode', 'HTML'); form.append('link_preview_options', JSON.stringify({ is_disabled: true })); return form })())
    if (ok) return
    return reply(chatId, text, kb)
  }
  // Detail > batas caption → foto dulu tanpa caption, teks penuh menyusul sebagai pesan terpisah
  if (photo) await tg('sendPhoto', { chat_id: chatId, photo, link_preview_options: { is_disabled: true } })
  else await tg('sendPhoto', form)
  return reply(chatId, text, kb)
}

// ── Hubungkan akun (dipanggil dari website) ──
// Migrasi saldo lama bot (BotLedger dari file JSON VPS) — sekali pakai.
export async function migrateBotLedger(telegramId, userId) {
  let migrated = 0
  const ledger = await prisma.botLedger.findMany({
    where: { telegramId: String(telegramId), consumedAt: null },
  })
  for (const row of ledger) {
    if (row.amount > 0) {
      migrated += row.amount
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { balance: { increment: row.amount } } }),
        prisma.balanceTransaction.create({
          data: { userId, amount: row.amount, type: 'refund', note: 'Migrasi saldo lama bot Telegram ke akun website' },
        }),
      ])
    }
    await prisma.botLedger.update({ where: { id: row.id }, data: { consumedAt: new Date() } })
  }
  return migrated
}
// Kirim konfirmasi “akun terhubung” ke chat Telegram setelah link dari website.
export async function notifyLinked(telegramId, user, migrated = 0) {
  const fresh = await prisma.user.findUnique({ where: { id: user.id } })
  await reply(String(telegramId),
    s_('linked', 'id', {
      name: esc(fresh?.name || user.name),
      balance: rp(fresh?.balance ?? user.balance),
      migrated: migrated > 0 ? s_('migrated', 'id', { amount: rp(migrated) }) : '',
    }),
    IK([[{ text: '🚀 Buka Menu Utama', callback_data: 'm:menu' }]]))
}

// ── Fitur: Saldo ──
async function showBalance(chatId, user, lang) {
  if (!user) return reply(chatId, s_('notLinked', lang))
  const [spent, min] = await Promise.all([spendOf(user.id), minWithdrawGlobal()])
  const eligible = spent >= min
  return reply(chatId, s_('balance', lang, {
    balance: rp(user.balance),
    spent: rp(spent),
    eligible: eligible ? s_('eligible', lang) : s_('notEligible', lang, { min: rp(min) }),
  }))
}

// ── Fitur: Check-in (pakai aturan sama persis dengan website) ──
const CHECKIN_REWARD = 300
const CHECKIN_BONUS = 2000
const CHECKIN_CYCLE = 7
const startOfUtcDay = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
const isSameUtcDay = (a, b) => startOfUtcDay(a) === startOfUtcDay(b)
const isYesterdayUtc = (d, now = new Date()) => {
  const y = new Date(now)
  y.setUTCDate(y.getUTCDate() - 1)
  return isSameUtcDay(d, y)
}

async function checkinStatus(chatId, user, lang) {
  if (!user) return reply(chatId, s_('notLinked', lang))
  const now = new Date()
  const already = user.lastCheckInAt && isSameUtcDay(user.lastCheckInAt, now)
  let nextStreak = 1
  if (user.lastCheckInAt && isYesterdayUtc(user.lastCheckInAt, now)) nextStreak = (user.checkInStreak || 0) + 1
  const reward = nextStreak >= CHECKIN_CYCLE ? CHECKIN_BONUS : CHECKIN_REWARD
  return reply(chatId, s_('checkinStatus', lang, {
    streak: already ? user.checkInStreak : (nextStreak > 1 ? user.checkInStreak : 0),
    reward: rp(reward),
    can: already ? s_('alreadyCheckin', lang) : s_('canCheckin', lang),
  }), already ? null : IK([[{ text: '🎁 Check-in Sekarang', callback_data: 'm:chkgo' }]]))
}

async function checkinGo(chatId, user, lang) {
  if (!user) return reply(chatId, s_('notLinked', lang))
  const now = new Date()
  if (user.lastCheckInAt && isSameUtcDay(user.lastCheckInAt, now)) {
    return reply(chatId, s_('alreadyCheckin', lang))
  }
  let newStreak = 1
  if (user.lastCheckInAt && isYesterdayUtc(user.lastCheckInAt, now)) newStreak = (user.checkInStreak || 0) + 1
  const reward = newStreak >= CHECKIN_CYCLE ? CHECKIN_BONUS : CHECKIN_REWARD
  const finalStreak = newStreak >= CHECKIN_CYCLE ? 0 : newStreak
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { balance: { increment: reward }, checkInStreak: finalStreak, lastCheckInAt: now },
    }),
    prisma.balanceTransaction.create({
      data: {
        userId: user.id, amount: reward, type: 'checkin',
        note: newStreak >= CHECKIN_CYCLE
          ? `Check-in via Telegram (hari ke-${newStreak}) — bonus Rp ${CHECKIN_BONUS.toLocaleString('id-ID')} 🎉`
          : `Check-in via Telegram (hari ke-${newStreak}) — Rp ${CHECKIN_REWARD.toLocaleString('id-ID')}`,
      },
    }),
  ])
  return reply(chatId, s_('checkinOk', lang, {
    reward: rp(reward), streak: newStreak,
    cycle: newStreak >= CHECKIN_CYCLE ? s_('cycleDone', lang) : '',
    balance: rp(updated.balance),
  }))
}

// ── Fitur: Pesanan terakhir ──
async function showOrders(chatId, user, lang) {
  if (!user) return reply(chatId, s_('notLinked', lang))
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, total: true, currency: true, status: true },
  })
  if (!orders.length) return reply(chatId, s_('noOrders', lang))
  const lines = orders.map((o) => {
    const total = o.currency === 'IDR' ? rp(o.total) : `$${(o.total / 100).toFixed(2)}`
    return `• <code>${esc(o.id)}</code>\n  ${total} · ${statusLine(o.status, lang)}`
  })
  return reply(chatId, s_('ordersHeader', lang) + lines.join('\n'))
}

// ── Fitur: Flash Sale (real-time dari katalog website) ──
async function showFlash(chatId, lang) {
  const items = await prisma.product.findMany({
    where: { active: true, flashSale: true },
    select: { name: true, price: true, flashPrice: true, tiers: true, stockOut: true },
    take: 12,
  })
  if (!items.length) return reply(chatId, s_('empty', lang))
  const lines = items.slice(0, 10).map((p) => {
    let tiers = []
    try { tiers = typeof p.tiers === 'string' ? JSON.parse(p.tiers) : (p.tiers || []) } catch { tiers = [] }
    const sale = Number(p.flashPrice) > 0 ? Number(p.flashPrice) : Number(p.price)
    const orig = Number(p.price) > sale ? Number(p.price) : Math.round(sale * 3 / 1000) * 1000
    const disc = orig > 0 ? Math.max(0, Math.round((1 - sale / orig) * 100)) : 0
    const dur = tiers[0]?.label ? ` ${esc(tiers[0].label)}` : ''
    const out = p.stockOut ? ' ⛔' : ''
    return s_('flashLine', lang, { name: esc(p.name), dur, price: rp(sale), orig: rp(orig), disc }) + out
  })
  return reply(chatId, s_('flashHeader', lang, { n: items.length }) + lines.join('\n'))
}

// ═══ Katalog & alur beli — order masuk DB website, aturan sama dengan orders.js ═══
const tierList = (prod) => {
  try { return typeof prod.tiers === 'string' ? JSON.parse(prod.tiers) : (prod.tiers || []) } catch { return [] }
}
// Harga tier sesuai aturan website: flash sale hanya berlaku untuk tier pertama.
function unitPriceOf(prod, tierIdx) {
  const tiers = tierList(prod)
  const tier = tiers[tierIdx] || tiers[0]
  if (!tier) return null
  // Sama dengan server (orders.js): flashPrice hanya sah bila > 0; 0/null = harga normal.
  return (tierIdx <= 0 && prod.flashSale && Number(prod.flashPrice) > 0) ? Number(prod.flashPrice) : (tier.price ?? prod.price)
}
async function showCatalog(chatId, lang, page = 0) {
  const prods = await prisma.product.findMany({ where: { active: true }, select: { category: true }, orderBy: { category: 'asc' } })
  const cats = [...new Set(prods.map((p) => p.category).filter(Boolean))]
  if (!cats.length) return reply(chatId, s_('catEmpty', lang))
  const per = 8
  const start = page * per
  const slice = cats.slice(start, start + per)
  const rows = slice.map((c) => [{ text: `${catEmoji(c)} ${c}`, callback_data: `cat:${c}:0` }])
  const nav = []
  if (page > 0) nav.push({ text: s_('back', lang), callback_data: `catpg:${page - 1}` })
  if (start + per < cats.length) nav.push({ text: s_('more', lang), callback_data: `catpg:${page + 1}` })
  if (nav.length) rows.push(nav)
  rows.push([{ text: '⚡ Flash Sale', callback_data: 'm:flash' }])
  return reply(chatId, s_('catalogTitle', lang), IK(rows))
}
async function showCategory(chatId, lang, cat, page = 0) {
  const prods = await prisma.product.findMany({ where: { active: true, category: cat }, orderBy: { createdAt: 'desc' } })
  if (!prods.length) return reply(chatId, s_('catEmpty', lang))
  const per = 6
  const start = page * per
  const slice = prods.slice(start, start + per)
  const rows = slice.map((p) => [{ text: `${p.stockOut ? '⛔ ' : ''}${p.name} — ${rp(unitPriceOf(p, 0) ?? p.price)}`, callback_data: `sel:${p.id}` }])
  const nav = []
  if (page > 0) nav.push({ text: s_('back', lang), callback_data: `cat:${cat}:${page - 1}` })
  if (start + per < prods.length) nav.push({ text: s_('more', lang), callback_data: `cat:${cat}:${page + 1}` })
  if (nav.length) rows.push(nav)
  rows.push([{ text: s_('catBack', lang), callback_data: 'catpg:0' }])
  return reply(chatId, s_('prodPick', lang, { cat: esc(cat), n: prods.length }), IK(rows))
}
async function showProduct(chatId, lang, pid) {
  const p = await prisma.product.findUnique({ where: { id: pid } })
  if (!p || !p.active) return reply(chatId, s_('tierGone', lang))
  const out = p.stockOut ? s_('outOfStock', lang) : ''
  const tiers = tierList(p)
  const rows = []
  if (!p.stockOut) {
    tiers.slice(0, 6).forEach((t, i) => {
      rows.push([{ text: `${t.label} — ${rp(unitPriceOf(p, i) ?? t.price)}`, callback_data: `tier:${p.id}:${i}` }])
    })
  }
  rows.push([{ text: '🛒 Buka di Website', url: `${STORE_URL}/product/${p.id}` }])
  rows.push([{ text: s_('catBack', lang), callback_data: `cat:${p.category}:0` }])
  const note = tiers[0]?.note ? `\n\n<i>${esc(tiers[0].note)}</i>` : ''
  const text = s_('prodDetail', lang, { name: esc(p.name), out, vendor: esc(p.vendor), cat: esc(p.category), tagline: esc(p.tagline || '') }) + note + (p.stockOut ? '' : `\n\n${s_('tierPick', lang)}`)
  return sendProductDetail(chatId, p, text, IK(rows))
}
async function checkoutMenu(chatId, lang, user, pid, tierIdx) {
  const p = await prisma.product.findUnique({ where: { id: pid } })
  if (!p || !p.active) return reply(chatId, s_('tierGone', lang))
  if (p.stockOut) return reply(chatId, s_('prodDetail', lang, { name: esc(p.name), out: s_('outOfStock', lang), vendor: esc(p.vendor), cat: esc(p.category), tagline: esc(p.tagline || '') }))
  const tiers = tierList(p)
  const tier = tiers[tierIdx]
  if (!tier) return reply(chatId, s_('tierGone', lang))
  const total = (unitPriceOf(p, tierIdx) ?? tier.price) + PAYMENT_FEE_IDR
  await setState(chatId, { buy: { pid, tierIdx, method: null, asset: null, step: 'method' } })
  const rows = [[{ text: '📲 QRIS', callback_data: `payq:${pid}:${tierIdx}` }]]
  rows.push(CRYPTO.assets.map((a) => ({ text: `🪙 ${a.symbol}`, callback_data: `payc:${pid}:${tierIdx}:${a.id}` })))
  if (user.balance >= total) rows.push([{ text: `💳 Pakai Saldo (${rp(user.balance)})`, callback_data: `paybal:${pid}:${tierIdx}` }])
  rows.push([{ text: s_('catBack', lang), callback_data: `sel:${pid}` }])
  return reply(chatId, s_('payTitle', lang, { product: esc(p.name), tier: esc(tier.label), total: rp(total), fee: rp(PAYMENT_FEE_IDR) }), IK(rows))
}
async function payQris(chatId, lang, user, pid, tierIdx) {
  const p = await prisma.product.findUnique({ where: { id: pid } })
  if (!p || !p.active || p.stockOut) return reply(chatId, s_('tierGone', lang))
  const tier = tierList(p)[tierIdx]
  if (!tier) return reply(chatId, s_('tierGone', lang))
  const total = (unitPriceOf(p, tierIdx) ?? tier.price) + PAYMENT_FEE_IDR
  await setState(chatId, { buy: { pid, tierIdx, method: 'qris', asset: null, step: 'await_proof' } })
  return tg('sendPhoto', {
    chat_id: chatId,
    photo: qrImageUrl(buildQrisPayload(total)),
    caption: s_('payQris', lang, { total: rp(total) }),
    parse_mode: 'HTML',
  })
}
async function payCrypto(chatId, lang, user, pid, tierIdx, assetId) {
  const p = await prisma.product.findUnique({ where: { id: pid } })
  if (!p || !p.active || p.stockOut) return reply(chatId, s_('tierGone', lang))
  const tier = tierList(p)[tierIdx]
  if (!tier) return reply(chatId, s_('tierGone', lang))
  const asset = CRYPTO.assets.find((a) => a.id === assetId) || CRYPTO.assets[0]
  const total = (unitPriceOf(p, tierIdx) ?? tier.price) + PAYMENT_FEE_IDR
  await setState(chatId, { buy: { pid, tierIdx, method: 'crypto', asset: asset.id, step: 'await_tx' } })
  return reply(chatId, s_('payCrypto', lang, { amount: toCryptoAmount(total, asset), symbol: asset.symbol, address: asset.address, network: CRYPTO.network }))
}
async function payBalance(chatId, lang, user, pid, tierIdx) {
  const p = await prisma.product.findUnique({ where: { id: pid } })
  if (!p || !p.active || p.stockOut) return reply(chatId, s_('tierGone', lang))
  const tier = tierList(p)[tierIdx]
  if (!tier) return reply(chatId, s_('tierGone', lang))
  const total = (unitPriceOf(p, tierIdx) ?? tier.price) + PAYMENT_FEE_IDR
  if (user.balance < total) return reply(chatId, s_('payBalShort', lang, { balance: rp(user.balance) }))
  const order = await createBotOrder(user, p, tierIdx, { method: 'manual', proofRef: null, txHash: null, asset: null, payAmount: null, balanceUsed: total })
  if (!order) return reply(chatId, s_('err', lang))
  await setState(chatId, { buy: null })
  return orderDone(chatId, lang, user, order)
}
// Buat order di DB website — validasi & transaksi mengikuti orders.js (stok atomik,
// fee 455, saldo dipotong atomik, BalanceTransaction tercatat).
async function createBotOrder(user, p, tierIdx, { method, proofRef, txHash, asset, payAmount, balanceUsed }) {
  const tiers = tierList(p)
  const tier = tiers[tierIdx] || tiers[0]
  const price = unitPriceOf(p, tierIdx)
  if (!tier || price == null) return null
  if (p.stock !== -1) {
    const dec = await prisma.product.updateMany({ where: { id: p.id, stock: { gte: 1 } }, data: { stock: { decrement: 1 } } })
    if (dec.count === 0) return null
  }
  const total = Math.max(0, price + PAYMENT_FEE_IDR - (balanceUsed || 0))
  try {
    return await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          id: makeBotOrderId(),
          userId: user.id,
          deliveryEmail: user.email,
          activation: 'new',
          status: 'PROCESSING',
          currency: 'IDR',
          subtotal: price,
          discount: 0,
          total,
          fee: PAYMENT_FEE_IDR,
          paymentMethod: method,
          paymentAsset: asset || null,
          paymentAmount: payAmount || null,
          paymentTxHash: txHash ? String(txHash).trim() : null,
          paymentProof: proofRef || null,
          adminNote: method === 'manual'
            ? 'Order via bot Telegram — dibayar penuh pakai Saldo (lihat BalanceTransaction)'
            : 'Order via bot Telegram',
          items: { create: [{ productId: p.id, name: p.name, vendor: p.vendor, logo: p.logo || null, brand: p.brand || null, tierLabel: tier.label, price, qty: 1 }] },
        },
        include: { items: true },
      })
      if (balanceUsed > 0) {
        const bal = await tx.user.updateMany({ where: { id: user.id, balance: { gte: balanceUsed } }, data: { balance: { decrement: balanceUsed } } })
        if (bal.count === 0) throw new Error('Saldo tidak mencukupi')
        await tx.balanceTransaction.create({
          data: { userId: user.id, amount: -balanceUsed, type: 'purchase', note: `Pakai saldo untuk pesanan ${o.id} (via Telegram)`, orderId: o.id },
        })
      }
      return o
    })
  } catch (e) {
    console.error('bot order error:', e.message)
    if (p.stock !== -1) await prisma.product.update({ where: { id: p.id }, data: { stock: { increment: 1 } } }).catch(() => {})
    return null
  }
}
async function orderDone(chatId, lang, user, order) {
  notify(user.id, { type: 'order_created', title: `Pesanan ${order.id} diterima`, body: 'Pembayaran sedang kami verifikasi.', orderId: order.id })
  notifyAdmins({ type: 'admin_new_order', title: `Pesanan baru ${order.id}`, body: '1 item · via bot Telegram', orderId: order.id })
  return reply(chatId,
    s_('orderMade', lang, {
      id: esc(order.id),
      items: order.items.map((it) => `• ${esc(it.name)} · ${esc(it.tierLabel)}`).join('\n'),
      total: rp(order.total),
      email: esc(user.email),
    }),
    IK([[{ text: '📦 Lihat Pesanan', url: `${STORE_URL}/orders/${order.id}` }]]))
}

// ── Picker bahasa ──
async function showLang(chatId) {
  const codes = Object.entries(LANGS)
  const rows = []
  for (let i = 0; i < codes.length; i += 3) {
    rows.push(codes.slice(i, i + 3).map(([code, label]) => ({ text: label, callback_data: `lang:${code}` })))
  }
  return reply(chatId, '🌐 Pilih bahasa / Pick language:', IK(rows))
}

// ── Router update Telegram ──
export async function handleTelegramUpdate(update) {
  let chatId = null
  try {
    const cb = update.callback_query
    if (cb) {
      chatId = cb.message?.chat?.id
      const tgId = String(cb.from.id)
      const lang = (await getState(chatId)).lang
      tg('answerCallbackQuery', { callback_query_id: cb.id })
      const parts = String(cb.data || '').split(':')
      const act = parts[0]

      if (act === 'lang') {
        await setState(chatId, { lang: parts[1] })
        return reply(chatId, s_('langSaved', parts[1], { lang: LANGS[parts[1]] || parts[1] }))
      }
      if (act === 'm:lang') return showLang(chatId)
      if (act === 'm:menu') {
        const user = await userByTelegram(tgId)
        const m = await menuFor(user, lang, tgId)
        return reply(chatId, m.text, m.kb)
      }
      if (act === 'm:link') return reply(chatId, s_('notLinked', lang), linkKb(tgId))

      // Katalog, produk & flash sale — bisa dibuka siapa saja (guest maupun user)
      if (act === 'm:cat' || act === 'catpg') return showCatalog(chatId, lang, act === 'catpg' ? (parseInt(parts[1], 10) || 0) : 0)
      if (act === 'cat') return showCategory(chatId, lang, parts[1], parseInt(parts[2], 10) || 0)
      if (act === 'sel') return showProduct(chatId, lang, parts[1])
      if (act === 'm:flash') return showFlash(chatId, lang)
      if (act === 'buycancel') { await setState(chatId, { buy: null }); return reply(chatId, s_('buyCancel', lang)) }

      const user = await userByTelegram(tgId)
      if (act === 'm:bal') {
        if (!user) {
          const kb = IK([
            [{ text: '🔗 Hubungkan Akun Web', url: `${STORE_URL}/balance?link=${tgId}` }],
            [{ text: '« Kembali ke Menu', callback_data: 'm:menu' }],
          ])
          return reply(chatId, s_('balGuest', lang), kb)
        }
        return showBalance(chatId, user, lang)
      }
      if (act === 'm:chk' || act === 'm:chkgo') {
        if (!user) {
          const kb = IK([
            [{ text: '🔗 Hubungkan Akun Web', url: `${STORE_URL}/balance?link=${tgId}` }],
            [{ text: '« Kembali ke Menu', callback_data: 'm:menu' }],
          ])
          return reply(chatId, s_('chkGuest', lang), kb)
        }
        if (act === 'm:chkgo') return checkinGo(chatId, user, lang)
        return checkinStatus(chatId, user, lang)
      }
      if (act === 'm:ord') {
        if (!user) {
          const kb = IK([
            [{ text: '🔗 Hubungkan Akun Web', url: `${STORE_URL}/balance?link=${tgId}` }],
            [{ text: '« Kembali ke Menu', callback_data: 'm:menu' }],
          ])
          return reply(chatId, s_('ordGuest', lang), kb)
        }
        return showOrders(chatId, user, lang)
      }
      // Checkout — jika belum terhubung, tawarkan 1-klik link atau beli di web
      if (act === 'tier') {
        if (!user) {
          const kb = IK([
            [{ text: '🔗 Hubungkan Akun Website (1-Klik)', url: `${STORE_URL}/balance?link=${tgId}` }],
            [{ text: '🛒 Beli Langsung di Website', url: `${STORE_URL}/product/${parts[1]}` }],
            [{ text: '« Kembali ke Produk', callback_data: `sel:${parts[1]}` }],
          ])
          return reply(chatId, s_('checkoutGuest', lang), kb)
        }
        return checkoutMenu(chatId, lang, user, parts[1], parseInt(parts[2], 10) || 0)
      }
      if (!user) return reply(chatId, s_('notLinked', lang), linkKb(tgId))
      if (act === 'payq') return payQris(chatId, lang, user, parts[1], parseInt(parts[2], 10) || 0)
      if (act === 'payc') return payCrypto(chatId, lang, user, parts[1], parseInt(parts[2], 10) || 0, parts[3])
      if (act === 'paybal') return payBalance(chatId, lang, user, parts[1], parseInt(parts[2], 10) || 0)
      return
    }

    const msg = update.message
    if (msg?.text && (msg.chat.type === 'private')) {
      chatId = msg.chat.id
      const tgId = String(msg.from.id)
      const st = await getState(chatId)
      const lang = st.lang
      const text = msg.text.trim()

      if (text.startsWith('/start')) {
        return sendStart(chatId, tgId)
      }
      if (text === '/cancel') {
        await setState(chatId, { buy: null })
        return reply(chatId, s_('buyCancel', lang))
      }
      if (text.startsWith('/menu') || text === '/help') {
        const user = await userByTelegram(tgId)
        const m = await menuFor(user, lang, tgId)
        return sendBanner(chatId, m.text, m.kb)
      }
      // Checkout crypto: user mengirim TX Hash saat state menunggu
      if (st.buy?.step === 'await_tx') {
        const tx = text.replace(/\s+/g, '')
        if (tx.length < 10) return reply(chatId, s_('txShort', lang))
        const dupe = await prisma.order.findFirst({ where: { paymentTxHash: tx } })
        if (dupe) return reply(chatId, s_('txDup', lang))
        reply(chatId, s_('txGot', lang))
        const user = await userByTelegram(tgId)
        if (!user) return reply(chatId, s_('notLinked', lang), linkKb(tgId))
        const p = await prisma.product.findUnique({ where: { id: st.buy.pid } })
        if (!p || !p.active || p.stockOut) return reply(chatId, s_('tierGone', lang))
        const asset = CRYPTO.assets.find((a) => a.id === st.buy.asset) || CRYPTO.assets[0]
        const total = (unitPriceOf(p, st.buy.tierIdx) ?? 0) + PAYMENT_FEE_IDR
        const order = await createBotOrder(user, p, st.buy.tierIdx, {
          method: 'crypto', proofRef: null, txHash: tx, asset: asset.symbol,
          payAmount: `${toCryptoAmount(total, asset)} ${asset.symbol}`, balanceUsed: 0,
        })
        if (!order) return reply(chatId, s_('err', lang))
        await setState(chatId, { buy: null })
        return orderDone(chatId, lang, user, order)
      }
      // Teks lain → menu
      const user = await userByTelegram(tgId)
      const m = await menuFor(user, lang, tgId)
      return reply(chatId, m.text, m.kb)
    }

    // Foto bukti transfer (QRIS) saat checkout menunggu bukti
    if (msg?.photo && msg.chat?.type === 'private') {
      chatId = msg.chat.id
      const st2 = await getState(chatId)
      if (st2.buy?.step !== 'await_proof') return
      const tgId2 = String(msg.from.id)
      const user = await userByTelegram(tgId2)
      if (!user) return reply(chatId, s_('notLinked', st2.lang), linkKb(tgId2))
      const fileId = msg.photo[msg.photo.length - 1].file_id
      const g = await tgRes('getFile', { file_id: fileId })
      const fp = g?.result?.file_path
      if (!fp) return reply(chatId, s_('proofFail', st2.lang))
      const r = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fp}`)
      if (!r.ok) return reply(chatId, s_('proofFail', st2.lang))
      const buf = Buffer.from(await r.arrayBuffer())
      const p = await prisma.product.findUnique({ where: { id: st2.buy.pid } })
      if (!p || !p.active || p.stockOut) return reply(chatId, s_('tierGone', st2.lang))
      reply(chatId, s_('proofGot', st2.lang))
      const proofRef = await saveUpload(buf, { prefix: 'proof', originalname: 'telegram-proof.jpg', contentType: r.headers.get('content-type') || 'image/jpeg' })
      const order = await createBotOrder(user, p, st2.buy.tierIdx, { method: 'qris', proofRef, txHash: null, asset: null, payAmount: null, balanceUsed: 0 })
      if (!order) return reply(chatId, s_('err', st2.lang))
      await setState(chatId, { buy: null })
      return orderDone(chatId, st2.lang, user, order)
    }
  } catch (e) {
    console.error('telegramBot error:', e.message)
    if (chatId) reply(chatId, s_('err', 'id'))
  }
}

// ── Notifikasi ke user website yang terhubung Telegram (dipakai server) ──
export async function sendTelegramToUser(userId, key, vars = {}) {
  if (!BOT_TOKEN) return false
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, blocked: true },
    })
    if (!user?.telegramId || user.blocked) return false
    const text = s_(key, 'id', vars)
    await tg('sendMessage', { chat_id: user.telegramId, text, parse_mode: 'HTML' })
    return true
  } catch (e) {
    console.error('sendTelegramToUser error:', e.message)
    return false
  }
}
