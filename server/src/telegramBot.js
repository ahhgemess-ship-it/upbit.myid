// ═══════════════════════════════════════════════════════════════════
// BOT TELEGRAM EVOLUSIAI — versi serverless (webhook, tanpa VPS)
// Satu dompet dengan website: saldo, check-in, order = database Neon.
// State percakapan disimpan di tabel TelegramState (serverless tanpa memori).
// SetWebhook:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://evolusiai.xyz/api/telegram/webhook"
// Env: TELEGRAM_BOT_TOKEN=...  (atau BOT_TOKEN untuk kompatibilitas bot lama)
// ═══════════════════════════════════════════════════════════════════
import { prisma } from './db.js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ''
const STORE_URL = 'https://evolusiai.xyz'

// ── Util Telegram Bot API (fire-and-forget; serverless tidak boleh menggantung) ──
async function tg(method, payload) {
  if (!BOT_TOKEN) return
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch { /* abaikan — pesan berikutnya tetap jalan */ }
}
const reply = (chatId, text, kb) => tg('sendMessage', {
  chat_id: chatId, text, parse_mode: 'HTML',
  link_preview_options: { is_disabled: true },
  ...(kb ? { reply_markup: kb } : {}),
})
const IK = (inline_keyboard) => ({ inline_keyboard })

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
    id: '👋 <b>Selamat datang di EvolusiAI Bot!</b>\n\nDompet kamu sekarang <b>satu dengan website</b> — saldo, check-in harian, dan pesanan sama persis dengan evolusiai.xyz.\n\nHubungkan akun website dulu supaya saldo & check-in kamu aktif di sini.',
    en: '👋 <b>Welcome to EvolusiAI Bot!</b>\n\nYour wallet is now <b>one with the website</b> — balance, daily check-in and orders match evolusiai.xyz exactly.\n\nLink your website account first to activate balance & check-in here.',
  },
  menu: {
    id: '⚙️ <b>Menu Utama</b>\n👤 {name}\n💰 Saldo: <b>{balance}</b>',
    en: '⚙️ <b>Main Menu</b>\n👤 {name}\n💰 Balance: <b>{balance}</b>',
  },
  notLinked: {
    id: '🔐 Akun belum terhubung.\n\n1️⃣ Buka evolusiai.xyz → <b>Saldoku</b>\n2️⃣ Klik <b>Hubungkan Telegram</b> → salin kodenya\n3️⃣ Kirim di sini: <code>/start KODE</code>\n\nAtau ketik kodenya langsung di chat ini.',
    en: '🔐 Account not linked.\n\n1️⃣ Open evolusiai.xyz → <b>Saldoku</b>\n2️⃣ Tap <b>Hubungkan Telegram</b> → copy the code\n3️⃣ Send here: <code>/start CODE</code>\n\nOr just type the code in this chat.',
  },
  linked: {
    id: '✅ <b>Akun terhubung!</b>\n👤 {name}\n💰 Saldo: <b>{balance}</b>{migrated}',
    en: '✅ <b>Account linked!</b>\n👤 {name}\n💰 Balance: <b>{balance}</b>{migrated}',
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
  invalidCode: {
    id: '❌ Kode tidak valid / sudah kedaluwarsa.\n\nAmbil kode baru: evolusiai.xyz → Saldoku → <b>Hubungkan Telegram</b>.',
    en: '❌ Invalid or expired code.\n\nGet a new one: evolusiai.xyz → Saldoku → <b>Hubungkan Telegram</b>.',
  },
  codeTaken: {
    id: '⚠️ Telegram ini sudah terhubung ke akun website lain, atau akun website itu sudah punya Telegram lain. Minta admin melepas ikatan dulu.',
    en: '⚠️ This Telegram is already linked to another website account (or vice versa). Ask admin to unlink first.',
  },
  err: { id: '⚠️ Terjadi kesalahan, coba lagi.', en: '⚠️ Something went wrong, try again.' },
  // Notifikasi order (dipakai server, id saja — pesan transaksional)
  notifCreated: { id: '🧾 <b>Pesanan dibuat</b>\n<code>{id}</code>\nTotal: <b>{total}</b>\n\nBayar via QRIS di website ya!' },
  notifCompleted: { id: '✅ <b>Pesanan selesai!</b>\n<code>{id}</code>\n\nAkses sudah dikirim ke email kamu. Cek detail pesanan di website.' },
  notifCancelled: { id: '❌ <b>Pesanan dibatalkan</b>\n<code>{id}</code>\n{refund}\n\nCek Saldoku di website untuk detailnya.' },
  notifRefund: { id: '↩️ <b>Refund masuk ke Saldo</b>\n<code>{id}</code>\n+<b>{amount}</b>' },
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
async function menuFor(user, lang) {
  const rows = [[
    { text: '💰 Saldo', callback_data: 'm:bal' },
    { text: '📅 Check-in', callback_data: 'm:chk' },
  ], [
    { text: '📦 Pesanan', callback_data: 'm:ord' },
    { text: '⚡ Flash Sale', callback_data: 'm:flash' },
  ], [
    { text: '🌐 Bahasa / Language', callback_data: 'm:lang' },
  ], [
    { text: '🛒 Buka evolusiai.xyz', url: STORE_URL },
  ]]
  if (user) {
    const card = { balance: rp(user.balance) }
    return { text: s_('menu', lang, { name: esc(user.name), balance: card.balance }), kb: IK(rows) }
  }
  return { text: s_('welcome', lang), kb: IK(rows) }
}

// ── Hubungkan akun via kode dari website ──
async function handleLink(chatId, telegramId, code, lang) {
  const clean = String(code || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(clean)) return reply(chatId, s_('invalidCode', lang))
  const link = await prisma.telegramLinkCode.findUnique({ where: { code: clean } })
  if (!link || link.expiresAt < new Date()) return reply(chatId, s_('invalidCode', lang))

  // Telegram ini sudah dipakai akun lain? / akun target sudah punya Telegram lain?
  const clash = await prisma.user.findFirst({ where: { telegramId: String(telegramId) } })
  if (clash && clash.id !== link.userId) return reply(chatId, s_('codeTaken', lang))
  const user = await prisma.user.findUnique({ where: { id: link.userId } })
  if (!user) return reply(chatId, s_('invalidCode', lang))
  if (user.telegramId && user.telegramId !== String(telegramId)) return reply(chatId, s_('codeTaken', lang))
  if (user.blocked) return reply(chatId, s_('err', lang))

  // ── Migrasi saldo lama bot (BotLedger dari file JSON VPS) — sekali pakai ──
  let migrated = 0
  const ledger = await prisma.botLedger.findMany({
    where: { telegramId: String(telegramId), consumedAt: null },
  })
  for (const row of ledger) {
    if (row.amount > 0) {
      migrated += row.amount
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { balance: { increment: row.amount } } }),
        prisma.balanceTransaction.create({
          data: { userId: user.id, amount: row.amount, type: 'refund', note: 'Migrasi saldo lama bot Telegram ke akun website' },
        }),
      ])
    }
    await prisma.botLedger.update({ where: { id: row.id }, data: { consumedAt: new Date() } })
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { telegramId: String(telegramId) } }),
    prisma.telegramLinkCode.deleteMany({ where: { userId: user.id } }),
  ])

  await setState(chatId, { lang })
  const fresh = await prisma.user.findUnique({ where: { id: user.id } })
  await reply(chatId,
    s_('linked', lang, {
      name: esc(fresh.name),
      balance: rp(fresh.balance),
      migrated: migrated > 0 ? s_('migrated', lang, { amount: rp(migrated) }) : '',
    }),
    IK([[{ text: '⚙️ Menu Utama', callback_data: 'm:menu' }]]))
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
      const [act, val] = String(cb.data || '').split(':')

      if (act === 'lang') {
        await setState(chatId, { lang: val })
        return reply(chatId, s_('langSaved', val, { lang: LANGS[val] || val }))
      }
      if (act === 'm:lang') return showLang(chatId)
      if (act === 'm:menu') {
        const user = await userByTelegram(tgId)
        const m = await menuFor(user, lang)
        return reply(chatId, m.text, m.kb)
      }
      if (act === 'm:link') return reply(chatId, s_('notLinked', lang))

      const user = await userByTelegram(tgId)
      if (!user) return reply(chatId, s_('notLinked', lang))
      if (act === 'm:bal') return showBalance(chatId, user, lang)
      if (act === 'm:chk') return checkinStatus(chatId, user, lang)
      if (act === 'm:chkgo') return checkinGo(chatId, user, lang)
      if (act === 'm:ord') return showOrders(chatId, user, lang)
      if (act === 'm:flash') return showFlash(chatId, lang)
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
        const code = text.split(/\s+/)[1]
        if (code) return handleLink(chatId, tgId, code, lang)
        const user = await userByTelegram(tgId)
        const m = await menuFor(user, lang)
        return reply(chatId, m.text, m.kb)
      }
      if (text.startsWith('/menu') || text === '/help') {
        const user = await userByTelegram(tgId)
        return reply(chatId, s_('notLinked', lang).split('\n\n')[0] === '🔐 Akun belum terhubung.' && !user
          ? s_('notLinked', lang)
          : s_('menu', lang, { name: esc(user?.name || '-'), balance: rp(user?.balance || 0) }),
          IK([[{ text: '⚙️ Buka Menu', callback_data: 'm:menu' }]]))
      }
      // Kode 6 digit diketik manual → coba hubungkan
      if (/^[A-Za-z0-9]{6}$/.test(text)) {
        return handleLink(chatId, tgId, text, lang)
      }
      // Teks lain → menu
      const user = await userByTelegram(tgId)
      const m = await menuFor(user, lang)
      return reply(chatId, m.text, m.kb)
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
