// ═══════════════════════════════════════════════════════════════════
// MIGRASI SALDO LAMA BOT VPS → DATABASE WEBSITE (BotLedger)
// Jalankan SEKALI di VPS tempat bot lama tinggal:
//   cd bot && DATABASE_URL="postgresql://..." node ../server/migrateBotBalance.mjs
// (atau copy file ini ke VPS + file upbit-bot-balance.json di folder yang sama)
//
// Apa yang dilakukan:
//   1. Baca bot/data/upbit-bot-balance.json (saldo per Telegram user ID)
//   2. Masukkan tiap saldo > 0 ke tabel BotLedger (telegramId, amount)
//   3. Begitu user /start KODE di bot baru → saldo otomatis dikreditkan
//      ke akun website mereka dan ditandai consumed (tidak bisa dobel)
// Aman dijalankan ulang: baris yang sudah ada (telegramId+amount belum
// consumed) dilewati.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function findBalFile() {
  const candidates = [
    process.argv[2],
    'bot/data/upbit-bot-balance.json',
    'data/upbit-bot-balance.json',
    'upbit-bot-balance.json',
    '../bot/data/upbit-bot-balance.json',
  ].filter(Boolean)
  for (const c of candidates) {
    try { readFileSync(c, 'utf8'); return c } catch { /* next */ }
  }
  return null
}

const file = findBalFile()
if (!file) {
  console.error('File saldo tidak ditemukan. Usage: node migrateBotBalance.mjs [path/ke/upbit-bot-balance.json]')
  process.exit(1)
}

let data
try {
  data = JSON.parse(readFileSync(file, 'utf8'))
} catch (e) {
  console.error('Gagal membaca JSON:', e.message)
  process.exit(1)
}

// Format file: { "<telegramId>": { balance, streak, lastCheckIn, totalSpent, purchased: [...] }, ... }
const rows = Object.entries(data)
  .map(([tgId, v]) => ({
    telegramId: String(tgId),
    amount: Math.max(0, Math.round(Number(v?.balance) || 0)),
  }))
  .filter((r) => /^\d+$/.test(r.telegramId))

console.log(`Ditemukan ${rows.length} user di ${file}`)
let created = 0, skipped = 0, zero = 0

for (const r of rows) {
  if (r.amount <= 0) { zero++; continue }
  const existing = await prisma.botLedger.findFirst({
    where: { telegramId: r.telegramId, consumedAt: null },
  })
  if (existing) { skipped++; continue }
  await prisma.botLedger.create({
    data: { telegramId: r.telegramId, amount: r.amount, note: 'Migrasi saldo bot VPS (upbit-bot-balance.json)' },
  })
  created++
  console.log(`  + telegram ${r.telegramId}: Rp ${r.amount.toLocaleString('id-ID')}`)
}

console.log(`\nSelesai: ${created} baris dibuat, ${skipped} sudah ada (dilewati), ${zero} saldo 0.`)
console.log('Saldo akan otomatis masuk ke akun website begitu user /start KODE di bot baru.')
await prisma.$disconnect()
