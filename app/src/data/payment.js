// Konfigurasi pembayaran EvolusiAI.
// Dua metode: QRIS & Crypto (BNB / USDT on BNB Smart Chain).

// Payload QRIS statis (Evolusiai Store) — hasil decode dari qris.jpeg.
const QRIS_STATIC =
  '00020101021126610016ID.CO.SHOPEE.WWW01189360091800231770190208231770190303UMI51440014ID.CO.QRIS.WWW0215ID10265313881830303UMI5204581753033605802ID5915Evolusiai Store6013JAKARTA PUSAT61051052062070703A016304760B'

// CRC16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — checksum wajib QRIS (tag 63).
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

export const QRIS = {
  merchant: 'EvolusiAi Store',
  nmid: 'ID1026531388183',
  // QRIS DINAMIS: sisipkan nominal (tag 54), ubah jadi dynamic (POI 11→12),
  // lalu hitung ulang CRC. Hasilnya nominal terisi otomatis di app pembayaran
  // user — tidak perlu ketik nominal manual.
  buildPayload: (amount) => {
    const amt = String(Math.max(0, Math.round(amount || 0)))
    let base = QRIS_STATIC.slice(0, -8) // buang tag CRC lama (6304XXXX)
    base = base.slice(0, 10) + '12' + base.slice(12) // POI: 11 (statis) → 12 (dinamis)
    const field = '54' + String(amt.length).padStart(2, '0') + amt // tag 54 = nominal
    base = base.replace('5802ID', field + '5802ID') // sisip sebelum tag 58 (negara)
    const signed = base + '6304'
    return signed + crc16(signed)
  },
}

// Alamat wallet crypto (BNB Smart Chain / BEP-20). Ganti dengan alamat aslimu.
export const CRYPTO = {
  network: 'BNB Smart Chain (BEP-20)',
  networkShort: 'BSC · BEP-20',
  assets: [
    {
      id: 'bnb',
      symbol: 'BNB',
      label: 'BNB',
      address: '0x02fd0906c6f873f35259889d7396f46b92a24aee',
      // Kurs estimasi untuk tampilan (IDR per 1 unit).
      idrRate: 9_650_000,
      decimals: 4,
      explorer: 'https://bscscan.com/tx/',
    },
    {
      id: 'usdt',
      symbol: 'USDT',
      label: 'USDT (on BNB)',
      address: '0x02fd0906c6f873f35259889d7396f46b92a24aee',
      idrRate: 16_300,
      decimals: 2,
      explorer: 'https://bscscan.com/tx/',
    },
  ],
}

// Kupon diskon. type: 'percent' | 'fixed'.
export const COUPONS = {
  UPBIT10: { type: 'percent', value: 10, label: 'Diskon 10%' },
  HEMAT50K: { type: 'fixed', value: 50000, label: 'Potongan Rp 50.000' },
  NEWBIE: { type: 'percent', value: 15, label: 'Diskon 15% pengguna baru' },
}

export function applyCoupon(code, subtotal) {
  const c = COUPONS[(code || '').trim().toUpperCase()]
  if (!c) return { valid: false, discount: 0, label: '', code: '' }
  const discount =
    c.type === 'percent'
      ? Math.round((subtotal * c.value) / 100)
      : Math.min(c.value, subtotal)
  return { valid: true, discount, label: c.label, code: code.trim().toUpperCase() }
}

// Estimasi jumlah crypto dari total IDR.
export const toCryptoAmount = (idr, asset) =>
  (idr / asset.idrRate).toFixed(asset.decimals)

// Buat kredensial yang "dikirim" setelah pembayaran dikonfirmasi.
// Deterministik dari id pesanan + produk supaya stabil saat di-render ulang.
export function buildCredentials(orderId, item) {
  const seed = `${orderId}-${item.id}-${item.tierLabel}`
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const pin = (h % 900000) + 100000
  const slug = item.id.replace(/[^a-z0-9]/gi, '')
  if (item.id.startsWith('api-')) {
    return {
      kind: 'apikey',
      label: 'API Key',
      value: `sk-evolusiai-${slug}-${h.toString(36)}${pin.toString(36)}`,
      note: 'Simpan API key ini. Top-up saldo sudah ditambahkan ke akun.',
    }
  }
  return {
    kind: 'account',
    label: 'Akun Premium',
    email: `${slug}.${(h % 9999).toString().padStart(4, '0')}@evolusiai-mail.id`,
    password: `EvolusiAI#${pin}${slug.slice(0, 3).toUpperCase()}`,
    note: 'Login memakai kredensial di atas. Jangan ubah email pemulihan.',
  }
}
