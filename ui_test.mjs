// UI Test lengkap untuk https://www.upbitapps.my.id
// Jalankan: cd /home/ubuntu/upbit-store && node ui_test.mjs
// Token dibaca dari /tmp/test_tokens.txt (USER_TOKEN / ADMIN_TOKEN) atau env
// UPBIT_TEST_USER_TOKEN / UPBIT_TEST_ADMIN_TOKEN.
import { createRequire } from 'module'
import { readFileSync } from 'fs'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/ubuntu/ex/node_modules/playwright')

const BASE = 'https://www.upbitapps.my.id'
function tokenFrom(name) {
  try {
    const m = readFileSync('/tmp/test_tokens.txt', 'utf8').match(new RegExp(name + '=(.+)'))
    if (m) return m[1]
  } catch { /* lanjut ke env */ }
  return process.env['UPBIT_TEST_' + name] || ''
}
const USER_TOKEN = tokenFrom('USER_TOKEN')
const ADMIN_TOKEN = tokenFrom('ADMIN_TOKEN')
if (!USER_TOKEN || !ADMIN_TOKEN) {
  console.error('Token testing tidak ditemukan. Jalankan script pembuat token dulu.')
  process.exit(1)
}
const CART_ITEM = [{ key: 'claude-pro-1-bulan__1 Bulan', id: 'claude-pro-1-bulan', name: 'Claude Pro', vendor: 'Anthropic', logo: '/logos/claude-white.png', brand: '#d97757', tierLabel: '1 Bulan', price: 326000, original: 326000, priceIntl: 326000, originalIntl: 326000, qty: 1 }]
const SESSION = { name: 'Buffy Test User', email: 'buffy.test.user@upbitapps.my.id', role: 'USER' }
const SESSION_ADMIN = { name: 'Buffy Test Admin', email: 'buffy.test.admin@upbitapps.my.id', role: 'ADMIN' }

let PASS = 0, FAIL = 0
const fails = []
function report(name, passed, detail = '') {
  if (passed) { PASS++; console.log(`  ✔ ${name}${detail ? ' — ' + detail : ''}`) }
  else { FAIL++; fails.push(name); console.log(`  ✘ ${name}${detail ? ' — ' + detail : ''}`) }
}

async function newPage(browser, { auth = false, admin = false, cartItems = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  if (auth || admin) {
    await ctx.addInitScript(({ token, session, cartItems }) => {
      localStorage.setItem('upbit_token', token)
      localStorage.setItem('upbit_session', JSON.stringify(session))
      if (cartItems) localStorage.setItem('upbit_cart', JSON.stringify(cartItems))
    }, { token: admin ? ADMIN_TOKEN : USER_TOKEN, session: admin ? SESSION_ADMIN : SESSION, cartItems })
  }
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  page.errors = errors
  return { ctx, page }
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })

try {
  // ================= 1. HOME =================
  console.log('\n[1] HOME')
  {
    const { ctx, page } = await newPage(browser)
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
    const title = await page.title()
    report('Title halaman', title.includes('Upbit Store'), title)
    const prodCards = await page.locator('.prod-card, .p-card, [class*=product] a, a[href*="/product/"]').count()
    report('Ada link produk', prodCards >= 3, `${prodCards} link`)
    const hero = await page.locator('h1, .hero, .display').first().isVisible().catch(() => false)
    report('Hero/heading tampil', hero)
    report('Tidak ada console error', page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
    await page.screenshot({ path: '/tmp/shot-home.png' })
    await ctx.close()
  }

  // ================= 2. STORE =================
  console.log('\n[2] STORE')
  {
    const { ctx, page } = await newPage(browser)
    await page.goto(BASE + '/store', { waitUntil: 'networkidle', timeout: 45000 })
    const cards = await page.locator('a[href*="/product/"]').count()
    report('Grid produk >= 5', cards >= 5, `${cards} kartu`)
    report('Tidak ada console error', page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // ================= 3. PRODUCT DETAIL + ADD TO CART =================
  console.log('\n[3] PRODUCT DETAIL + KERANJANG')
  {
    const { ctx, page } = await newPage(browser)
    await page.goto(BASE + '/product/claude-pro-1-bulan', { waitUntil: 'networkidle', timeout: 45000 })
    const buyBtn = page.getByRole('button', { name: /Tambah ke Keranjang|Beli Sekarang/i }).first()
    report('Tombol beli ada', await buyBtn.isVisible().catch(() => false))
    await buyBtn.click().catch(() => {})
    await page.waitForTimeout(800)
    await page.goto(BASE + '/cart', { waitUntil: 'networkidle', timeout: 45000 })
    const hasClaude = (await page.textContent('body')).includes('Claude Pro')
    report('Item di keranjang', hasClaude)
    report('Tidak ada console error', page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // ================= 4. FLASH SALE + ABOUT + TANPA TEKS DEMO =================
  console.log('\n[4] FLASH SALE + ABOUT + TEKS TERLARANG')
  {
    const { ctx, page } = await newPage(browser)
    await page.goto(BASE + '/flash-sale', { waitUntil: 'networkidle', timeout: 45000 })
    const fsHas = (await page.textContent('body')).includes('Flash Sale') || (await page.textContent('body')).toLowerCase().includes('flash')
    report('Flash Sale load', fsHas)
    await page.goto(BASE + '/about', { waitUntil: 'networkidle', timeout: 45000 })
    const body = await page.textContent('body')
    report('About load', body.length > 200)
    const banned = ['Demo checkout', 'dummy', 'simulasi', 'tidak ada dana nyata']
    let clean = true
    for (const b of banned) if (body.toLowerCase().includes(b.toLowerCase())) { clean = false; console.log(`    (teks terlarang ditemukan: ${b})`) }
    report('Tanpa teks demo/dummy/simulasi', clean)
    report('Tidak ada console error', page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // ================= 5. GANTI BAHASA =================
  console.log('\n[5] GANTI BAHASA')
  {
    const { ctx, page } = await newPage(browser)
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
    // cari tombol bahasa: ikon globe / ID / EN di navbar
    const langBtn = page.locator('button:has-text("ID"), button:has-text("EN"), [aria-label*="bahasa" i], [aria-label*="language" i], .lang, button:has-text("中文")').first()
    const found = await langBtn.isVisible().catch(() => false)
    report('Tombol bahasa ditemukan', found)
    if (found) {
      const before = (await page.textContent('body')).slice(0, 300)
      await langBtn.click().catch(() => {})
      await page.waitForTimeout(500)
      // klik pilihan English jika muncul
      const en = page.locator('text=English, [data-lang="en"], button:has-text("English")').first()
      if (await en.isVisible().catch(() => false)) await en.click().catch(() => {})
      await page.waitForTimeout(800)
      const after = (await page.textContent('body')).slice(0, 300)
      report('Bahasa berubah (EN)', before !== after, after.slice(0, 60))
      await page.screenshot({ path: '/tmp/shot-lang.png' })
    }
    await ctx.close()
  }

  // ================= 6. LOGIN (SIMULASI) + BALANCE + CHECK-IN =================
  console.log('\n[6] LOGIN + BALANCE + CHECK-IN')
  {
    const { ctx, page } = await newPage(browser, { auth: true })
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
    const body = await page.textContent('body')
    report('Navbar tampil user (inisial BT)', body.includes('BT') || body.includes('Menu akun'))
    // buka dropdown akun
    const acctBtn = page.getByLabel('Menu akun')
    const acctFound = await acctBtn.isVisible().catch(() => false)
    report('Dropdown akun ada', acctFound)
    if (acctFound) {
      await acctBtn.click().catch(() => {})
      await page.waitForTimeout(600)
      const dd = await page.textContent('body')
      report('Dropdown akun berisi menu (Saldo/Balance/Orders)', /Saldo|Balance|Orders|Pesanan/i.test(dd))
    }
    await page.goto(BASE + '/balance', { waitUntil: 'networkidle', timeout: 45000 })
    const bal = await page.textContent('body')
    report('Halaman saldo load', bal.includes('Saldo') || bal.toLowerCase().includes('balance'))
    report('Saldo ~90.300 tampil', bal.includes('90.300') || bal.includes('90300'), bal.match(/Rp\s*[\d.,]+/)?.[0] || '')
    report('Bagian check-in ada', bal.includes('Check-in') || bal.includes('checkin'))
    report('Syarat tarik 250k tampil', bal.includes('250.000') || bal.includes('250000'))
    report('Tidak ada console error', page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
    await page.screenshot({ path: '/tmp/shot-balance.png' })
    await ctx.close()
  }

  // ================= 7. CHECKOUT FLOW (pakai saldo) =================
  console.log('\n[7] CHECKOUT FLOW (QRIS + Cek Pembayaran)')
  {
    const { ctx, page } = await newPage(browser, { auth: true, cartItems: CART_ITEM })
    await page.goto(BASE + '/checkout', { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForSelector('.wizard', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(800)
    const emailInput = page.locator('input[type=email]').first()
    const emailVal = await emailInput.inputValue().catch(() => '')
    report('Step Email tampil (terisi otomatis)', /@/.test(emailVal), emailVal)
    // Lanjut
    await page.getByRole('button', { name: /Lanjut|Next/i }).first().click().catch(() => {})
    await page.waitForTimeout(600)
    // Aktivasi → pilih new (default) → Lanjut
    await page.getByRole('button', { name: /Lanjut|Next/i }).first().click().catch(() => {})
    await page.waitForTimeout(600)
    const body1 = await page.textContent('body')
    report('Step Ringkasan tampil', body1.includes('Claude Pro'))
    report('Opsi Pakai Saldo tampil', body1.includes('Pakai Saldo'))
    // centang pakai saldo
    const cb = page.locator('input[type=checkbox]').first()
    if (await cb.isVisible().catch(() => false)) await cb.check({ force: true }).catch(() => {})
    await page.waitForTimeout(400)
    // Lanjut ke payment
    await page.getByRole('button', { name: /Lanjut|Next/i }).first().click().catch(() => {})
    await page.waitForSelector('.qris-box', { timeout: 12000 }).catch(() => {})
    await page.waitForTimeout(500)
    const qrisVisible = await page.locator('.qris-box').isVisible().catch(() => false)
    report('Step Payment (QRIS) tampil', qrisVisible)
    const cekBtn = page.locator('button:has-text("Cek Pembayaran"), button:has-text("Check Payment")')
    report('Tombol Cek Pembayaran ada', await cekBtn.isVisible().catch(() => false))
    if (await cekBtn.isVisible().catch(() => false)) {
      await cekBtn.click()
      await page.waitForTimeout(800)
      const loading = await page.locator('text=/mengecek pembayaran|checking payment/i').isVisible().catch(() => false)
      report('Loading cek pembayaran muncul', loading)
      await page.waitForTimeout(2200)
      const uploadDrop = page.locator('.upload-drop')
      report('Area upload bukti muncul', await uploadDrop.isVisible().catch(() => false))
      const uploadInput = page.locator('input[type=file]')
      if (await uploadInput.count().catch(() => 0)) {
        await uploadInput.setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') })
        await page.waitForTimeout(800)
        const dropText = await uploadDrop.textContent().catch(() => '')
        report('Nama file bukti tampil', dropText.includes('proof.png'), dropText.trim().slice(0, 40))
        const confirm = page.getByRole('button', { name: /Konfirmasi Pembayaran|Confirm Payment/i })
        const canClick = await confirm.isEnabled().catch(() => false)
        report('Tombol Konfirmasi aktif', canClick)
      }
    }
    await page.screenshot({ path: '/tmp/shot-checkout.png' })
    report('Tidak ada console error', page.errors.length === 0, page.errors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // ================= 8. ADMIN PANEL =================
  console.log('\n[8] ADMIN PANEL')
  {
    const { ctx, page } = await newPage(browser, { admin: true })
    await page.goto(BASE + '/admin', { waitUntil: 'networkidle', timeout: 45000 })
    const b1 = await page.textContent('body')
    report('Halaman admin orders load', b1.length > 200)
    await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle', timeout: 45000 })
    const b2 = await page.textContent('body')
    report('Admin users load', b2.includes('@') || b2.includes('User') || b2.includes('user'))
    await page.goto(BASE + '/admin/products', { waitUntil: 'networkidle', timeout: 45000 })
    const b3 = await page.textContent('body')
    report('Admin products load', b3.length > 200)
    report('Tidak ada console error', page.errors.length === 0, page.errors.slice(0, 3).join(' | '))
    await ctx.close()
  }

  // ================= 9. MOBILE =================
  console.log('\n[9] MOBILE (375x667)')
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)) })
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 150)))
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    report('Tidak ada horizontal overflow', !overflow)
    const menuBtn = page.getByLabel('Toggle menu')
    const menuFound = await menuBtn.isVisible().catch(() => false)
    report('Tombol menu mobile ada', menuFound)
    if (menuFound) {
      await menuBtn.click().catch(() => {})
      await page.waitForTimeout(500)
      const menuOpen = await page.textContent('body')
      report('Menu mobile terbuka', menuOpen.includes('Store') || menuOpen.includes('Keranjang') || menuOpen.includes('Balance'))
      await page.screenshot({ path: '/tmp/shot-mobile.png' })
    }
    report('Tidak ada console error mobile', errors.length === 0, errors.slice(0, 2).join(' | '))
    await ctx.close()
  }
} catch (e) {
  console.log('\n✘ ERROR GLOBAL TEST:', String(e).slice(0, 300))
  FAIL++
} finally {
  await browser.close()
}

console.log('\n=========================================')
console.log(`HASIL: ${PASS} PASS, ${FAIL} FAIL`)
if (fails.length) console.log('GAGAL:', fails.join(', '))
process.exit(FAIL > 0 ? 1 : 0)
