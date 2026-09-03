// Sumber harga sisi-server untuk validasi pesanan (mirror dari frontend products.js).
// Harga di-validasi ulang di server agar tidak bisa dimanipulasi dari klien.

export const products = [
  { id: 'claude-pro', name: 'Claude Pro', vendor: 'Anthropic', category: 'AI Assistant', price: 326000, estimate: '10–20 menit',
    tiers: [{ label: '1 Bulan', price: 326000 }, { label: '1 Tahun', price: 3325200 }] },
  { id: 'claude-max-5x', name: 'Claude Max 5x', vendor: 'Anthropic', category: 'AI Assistant', price: 1630000, estimate: '10–20 menit',
    tiers: [{ label: '1 Bulan', price: 1630000 }, { label: '1 Tahun', price: 17604000 }] },
  { id: 'claude-max-20x', name: 'Claude Max 20x', vendor: 'Anthropic', category: 'AI Assistant', price: 3260000, estimate: '10–20 menit',
    tiers: [{ label: '1 Bulan', price: 3260000 }, { label: '1 Tahun', price: 35208000 }] },
  { id: 'google-ai-pro', name: 'Google AI Pro', vendor: 'Google', category: 'AI Assistant', price: 3520800, estimate: '10–20 menit',
    tiers: [{ label: '12 Bulan', price: 3520800 }, { label: '18 Bulan', price: 5040000 }] },
  { id: 'google-ai-ultra', name: 'Google AI Ultra', vendor: 'Google', category: 'AI Assistant', price: 1629000, estimate: null,
    tiers: [{ label: '1 Bulan', price: 1629000 }, { label: '1 Tahun', price: 17593200 }] },
  { id: 'chatgpt-plus', name: 'ChatGPT Plus', vendor: 'OpenAI', category: 'AI Assistant', price: 326000, estimate: null,
    tiers: [{ label: '1 Bulan', price: 326000 }, { label: '1 Tahun', price: 3520800 }] },
  { id: 'chatgpt-pro', name: 'ChatGPT Pro', vendor: 'OpenAI', category: 'AI Assistant', price: 1630000, estimate: null,
    tiers: [{ label: 'Pro 5x — 1 Bulan', price: 1630000 }, { label: 'Pro 20x — 1 Bulan', price: 3260000 }] },
  { id: 'kiro-ai', name: 'Kiro AI', vendor: 'Kiro', category: 'Developer', price: 326000, estimate: null,
    tiers: [{ label: 'Pro — 1.000 kredit', price: 326000 }, { label: 'Pro+ — 2.000 kredit', price: 652000 }, { label: 'Power — 10.000 kredit', price: 3260000 }] },
  { id: 'api-deepseek', name: 'API Key DeepSeek', vendor: 'DeepSeek', category: 'API', price: 25000, estimate: null,
    tiers: [{ label: '1.000 request', price: 25000 }, { label: '5.000 request', price: 110000 }, { label: '10.000 request', price: 200000 }] },
  { id: 'api-openai', name: 'API Key OpenAI', vendor: 'OpenAI', category: 'API', price: 45000, estimate: null,
    tiers: [{ label: '1.000 request', price: 45000 }, { label: '5.000 request', price: 200000 }, { label: '10.000 request', price: 380000 }] },
  { id: 'leonardo-ai-pro', name: 'Leonardo AI Pro', vendor: 'Leonardo', category: 'AI Image', price: 489000, estimate: null,
    tiers: [{ label: 'Artisan — 1 Bulan', price: 489000 }, { label: 'Artisan — Tahunan', price: 391000 }, { label: 'Maestro — 1 Bulan', price: 978000 }] },
  { id: 'higgsfield-ai-starter', name: 'Higgsfield Starter', vendor: 'Higgsfield', category: 'Promo', badge: 'STARTER', badgeColor: '#0284c7', price: 250000, priceIntl: 1500, flashPrice: 50000, flashPriceIntl: 300, estimate: '10–20 menit',
    tiers: [{ label: '1 Bulan', price: 50000, priceIntl: 300 }] },
  { id: 'higgsfield-ai-plus', name: 'Higgsfield Plus', vendor: 'Higgsfield', category: 'Promo', badge: 'PLUS', badgeColor: '#b45309', price: 650000, priceIntl: 3900, flashPrice: 130000, flashPriceIntl: 780, estimate: '10–20 menit',
    tiers: [{ label: '1 Bulan', price: 130000, priceIntl: 780 }] },
  { id: 'higgsfield-ai-ultra', name: 'Higgsfield Ultra', vendor: 'Higgsfield', category: 'Promo', badge: 'ULTRA', badgeColor: '#7c3aed', price: 1650000, priceIntl: 9900, flashPrice: 330000, flashPriceIntl: 1980, estimate: '10–20 menit',
    tiers: [{ label: '1 Bulan', price: 330000, priceIntl: 1980 }] },
]

export const coupons = [
  { code: 'UPBIT10', type: 'percent', value: 10, label: 'Diskon 10%' },
  { code: 'HEMAT50K', type: 'fixed', value: 50000, label: 'Potongan Rp 50.000' },
  { code: 'NEWBIE', type: 'percent', value: 15, label: 'Diskon 15% pengguna baru' },
]
