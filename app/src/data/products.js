// Katalog produk digital EvolusiAI — berdasarkan PRD (prdproduk.md).
// Harga dalam IDR. Kurs acuan 1 USD ≈ Rp 16.300 (estimasi, cek kurs terkini).
// Logo putih monokrom disimpan lokal di /public/logos, ditaruh di atas kotak warna brand.

// Harga internasional default (USD, dalam SEN) = pembulatan dari IDR ke dolar bulat.
// Admin bisa menimpa nilai ini lewat panel; DB menyimpan nilai eksplisit.
const INTL_RATE = 16300
const toIntlCents = (idr) => Math.max(1, Math.round(idr / INTL_RATE)) * 100
// USD (sen) presisi sesuai kurs — dipakai produk promo agar dolar akurat (mis. Rp50.000 → $3.07).
const promoCents = (idr) => Math.max(1, Math.round((idr / INTL_RATE) * 100))
const withIntl = (p) => ({
  ...p,
  priceIntl: p.priceIntl ?? toIntlCents(p.price),
  tiers: (p.tiers || []).map((t) => ({ ...t, priceIntl: t.priceIntl ?? toIntlCents(t.price) })),
})

// Pecah tiap "family" (produk multi-tier) menjadi produk-produk terpisah per tier,
// supaya katalog tampil lebih ramai & tiap varian jadi kartu sendiri.
const slug = (s) => (s || '').toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
function splitFamily(p) {
  // Produk PROMO (flash sale) tetap satu kartu dengan semua opsi durasi — tidak dipecah.
  if (!p.tiers || p.tiers.length <= 1 || p.category === 'Promo') return [p]
  return p.tiers.map((tier) => ({
    ...p,
    id: `${p.id}-${slug(tier.label)}`,
    price: tier.price,
    priceIntl: tier.priceIntl,
    tiers: [tier],
  }))
}

const FAMILIES = [
  {
    id: 'claude-pro',
    name: 'Claude Pro',
    vendor: 'Anthropic',
    category: 'AI Assistant',
    tagline: 'Asisten AI paling cerdas untuk riset, koding, dan menulis.',
    description:
      'Akses ke semua model Claude termasuk Sonnet 4.6 dan Opus 4.7, jauh di atas batas tier gratis. Termasuk Claude Code, Cowork, Skills, dan MCP untuk workflow developer, ditambah mode Research, Projects tanpa batas, extended thinking, dan integrasi Microsoft 365.',
    logo: '/logos/claude-white.png',
    brand: '#d97757',
    price: 326000,
    period: 'bln',
    rating: 4.9,
    sold: 1280,
    estimate: '10–20 menit',
    features: [
      'Semua model Claude (Sonnet 4.6 & Opus 4.7)',
      'Claude Code, Cowork, Skills & MCP',
      'Research, Projects tanpa batas, extended thinking',
      'Integrasi Microsoft 365 & voice mode',
    ],
    tiers: [
      { label: '1 Bulan', price: 326000 },
      { label: '1 Tahun', price: 3325200, note: 'Hemat ~17%' },
    ],
  },
  {
    id: 'claude-max-5x',
    name: 'Claude Max 5x',
    vendor: 'Anthropic',
    category: 'AI Assistant',
    tagline: 'Kapasitas 5x lipat Claude Pro untuk pengguna intensif.',
    description:
      'Kapasitas pemakaian 5x lipat dibanding Claude Pro dengan prioritas akses saat traffic tinggi. Cocok untuk pengguna harian intensif yang sering kena limit di paket Pro, dengan akses penuh ke Opus 4.7 dan seluruh tooling termasuk Claude Code.',
    logo: '/logos/claude-white.png',
    brand: '#d97757',
    price: 1630000,
    period: 'bln',
    rating: 4.9,
    sold: 420,
    estimate: '10–20 menit',
    features: [
      'Kapasitas pemakaian 5x lipat Claude Pro',
      'Prioritas akses saat traffic tinggi',
      'Cocok untuk pengguna harian intensif',
      'Akses penuh Opus 4.7 + seluruh tooling',
    ],
    tiers: [
      { label: '1 Bulan', price: 1630000 },
      { label: '1 Tahun', price: 17604000, note: 'Hemat ~10%' },
    ],
  },
  {
    id: 'claude-max-20x',
    name: 'Claude Max 20x',
    vendor: 'Anthropic',
    category: 'AI Assistant',
    tagline: 'Kelas power user — kapasitas 20x lipat Claude Pro.',
    description:
      'Kapasitas pemakaian 20x lipat dibanding Claude Pro — kelas power user. Ideal untuk menjalankan beberapa instance Claude Code paralel, dengan prioritas tertinggi dan akses penuh seluruh model dan fitur. Disebut deal terbaik di pasar untuk single power user.',
    logo: '/logos/claude-white.png',
    brand: '#d97757',
    price: 3260000,
    period: 'bln',
    rating: 5.0,
    sold: 260,
    estimate: '10–20 menit',
    features: [
      'Kapasitas pemakaian 20x lipat Claude Pro',
      'Jalankan beberapa instance Claude Code paralel',
      'Prioritas tertinggi di antara semua tier',
      'Akses penuh seluruh model & fitur',
    ],
    tiers: [
      { label: '1 Bulan', price: 3260000 },
      { label: '1 Tahun', price: 35208000, note: 'Hemat ~10%' },
    ],
  },
  {
    id: 'google-ai-pro',
    name: 'Google AI Pro',
    vendor: 'Google',
    category: 'AI Assistant',
    tagline: 'Gemini 3 Pro dengan integrasi penuh ekosistem Google.',
    description:
      'Akses penuh Gemini 3 Pro dengan fitur lanjutan seperti Deep Research dan Nano Banana Pro. Kuota lebih tinggi dari tier gratis, integrasi Gmail, Docs, dan Workspace, bonus YouTube Premium Lite, serta storage Google One yang besar. Tersedia dalam paket berlangganan 12 dan 18 bulan.',
    logo: '/logos/gemini-white.png',
    brand: '#1f6feb',
    price: 3520800,
    period: '12 bln',
    rating: 4.8,
    sold: 940,
    estimate: '10–20 menit',
    features: [
      'Gemini 3 Pro + Deep Research & Nano Banana Pro',
      'Integrasi Gmail, Docs & Workspace',
      'Bonus YouTube Premium Lite',
      'Storage Google One besar',
    ],
    tiers: [
      { label: '12 Bulan', price: 3520800, note: 'Hemat ~10%' },
      { label: '18 Bulan', price: 5040000, note: 'Paling hemat ~14%' },
    ],
  },
  {
    id: 'google-ai-ultra',
    name: 'Google AI Ultra',
    vendor: 'Google',
    category: 'AI Assistant',
    tagline: 'Limit tertinggi Gemini + Veo, Deep Think, dan agentic tools.',
    description:
      'Limit pemakaian 5x lebih tinggi dari AI Pro (hingga 20x di tier teratas). Akses awal fitur canggih: Deep Think, Gemini Spark, Veo untuk video generation, dan Flow. Termasuk storage 20 TB, YouTube Premium Lite, dan agentic tools seperti Project Mariner.',
    logo: '/logos/gemini-white.png',
    brand: '#1f6feb',
    price: 1629000,
    period: 'bln',
    rating: 4.9,
    sold: 310,
    features: [
      'Limit 5x–20x lebih tinggi dari AI Pro',
      'Deep Think, Gemini Spark, Veo & Flow',
      'Storage 20 TB + YouTube Premium Lite',
      'Agentic tools (Project Mariner / Agent Mode)',
    ],
    tiers: [
      { label: '1 Bulan', price: 1629000 },
      { label: '1 Tahun', price: 17593200, note: 'Hemat ~10%' },
    ],
  },
  {
    id: 'chatgpt-plus',
    name: 'ChatGPT Plus',
    vendor: 'OpenAI',
    category: 'AI Assistant',
    tagline: 'Akses GPT-5.5 dengan limit tinggi, Sora, dan Agent Mode.',
    description:
      'Akses GPT-5.5 (model flagship default) dengan limit mingguan tinggi dan bebas iklan. Termasuk Deep Research (10 run/bulan), Sora untuk video, Codex, Agent Mode, image generation 2.0, advanced voice mode, Custom GPTs, dan context window besar (~320 halaman teks).',
    logo: '/logos/openai-white.png',
    brand: '#10a37f',
    price: 326000,
    period: 'bln',
    rating: 4.8,
    sold: 1560,
    features: [
      'GPT-5.5 flagship, limit mingguan tinggi, bebas iklan',
      'Deep Research, Sora (video), Codex & Agent Mode',
      'Image generation 2.0 + advanced voice mode',
      'Context window ~320 halaman per percakapan',
    ],
    tiers: [
      { label: '1 Bulan', price: 326000 },
      { label: '1 Tahun', price: 3520800, note: 'Hemat ~10%' },
    ],
  },
  {
    id: 'chatgpt-pro',
    name: 'ChatGPT Pro',
    vendor: 'OpenAI',
    category: 'AI Assistant',
    tagline: 'GPT-5.5 Pro untuk pekerjaan profesional paling kompleks.',
    description:
      'Akses penuh GPT-5.5 Pro — mode komputasi maksimal untuk jawaban paling andal pada tugas kompleks. Termasuk akses tanpa batas (sesuai kebijakan wajar) ke seluruh model reasoning, mode suara lanjutan, Deep Research, Sora untuk video, dan Operator/Agent Mode. Paket bulanan resmi $200/bln.',
    logo: '/logos/openai-white.png',
    brand: '#10a37f',
    price: 3260000,
    priceIntl: 20000,
    period: 'bln',
    rating: 4.9,
    sold: 480,
    features: [
      'GPT-5.5 Pro — mode komputasi maksimal',
      'Akses tanpa batas seluruh model reasoning',
      'Deep Research, Sora (video) & Agent Mode',
      'Mode suara lanjutan tanpa batas',
    ],
    tiers: [
      { label: '1 Bulan', price: 3260000, priceIntl: 20000 },
    ],
  },
  {
    id: 'kiro-ai',
    name: 'Kiro AI',
    vendor: 'Kiro',
    category: 'Developer',
    tagline: 'AI IDE spec-driven bertenaga Opus 4.8 dari AWS.',
    description:
      'AI IDE berbasis spec-driven workflow yang membawa rigor engineering ke AI coding. Dilengkapi agent hooks untuk otomatisasi test, dokumentasi, dan scan saat event terjadi, sistem pay-as-you-go ($0.04/kredit) agar kerja tak berhenti mendadak, dan akses penuh Opus 4.8.',
    logo: '/logos/kiro-white.png',
    brand: '#7c3aed',
    price: 326000,
    period: 'bln',
    rating: 4.8,
    sold: 430,
    features: [
      'Spec-driven workflow — rigor engineering untuk AI coding',
      'Agent hooks: otomatisasi test, docs & scan',
      'Pay-as-you-go $0.04/kredit, kerja tak berhenti',
      'Akses penuh Opus 4.8',
    ],
    tiers: [
      { label: 'Pro — 1.000 kredit', price: 326000 },
      { label: 'Pro+ — 2.000 kredit', price: 652000 },
      { label: 'Power — 10.000 kredit', price: 3260000, note: 'Power user' },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    vendor: 'Anysphere',
    category: 'Developer',
    tagline: 'AI code editor tercepat dengan Agent & tab completion pintar.',
    description:
      'Cursor adalah AI code editor (berbasis VS Code) dengan tab completion super cepat, Agent mode untuk menyelesaikan tugas lintas-file secara otomatis, dan akses ke model frontier (Claude, GPT, Gemini). Tiap paket berbayar menyertakan kuota kredit pemakaian model premium senilai harga paketnya.',
    logo: '/logos/cursor-white.svg',
    brand: '#0f0f0f',
    price: 326000,
    priceIntl: 2000,
    period: 'bln',
    rating: 4.9,
    sold: 1120,
    features: [
      'Tab completion super cepat & Auto mode tanpa batas',
      'Agent mode untuk tugas lintas-file otomatis',
      'Akses model frontier (Claude, GPT, Gemini)',
      'Kredit pemakaian model premium sesuai paket',
    ],
    tiers: [
      { label: 'Pro', price: 326000, priceIntl: 2000 },
      { label: 'Pro+', price: 978000, priceIntl: 6000, note: 'Kredit 3x Pro' },
      { label: 'Ultra', price: 3260000, priceIntl: 20000, note: 'Multiplier 20x' },
    ],
  },
  {
    id: 'qoder',
    name: 'Qoder',
    vendor: 'Alibaba',
    category: 'Developer',
    tagline: 'Platform coding agentik dengan Quest Mode & Repo Wiki.',
    description:
      'Qoder adalah platform coding agentik dari Alibaba untuk pengembangan software nyata. Dilengkapi Quest Mode untuk delegasi tugas otonom, Repo Wiki yang membuat dokumentasi otomatis, completion & edit tanpa batas, serta sistem kredit untuk chat dan permintaan agent sesuai paket.',
    logo: '/logos/qoder-color.png',
    brand: '#18181b',
    price: 326000,
    priceIntl: 2000,
    period: 'bln',
    rating: 4.8,
    sold: 640,
    features: [
      'Quest Mode — delegasi tugas otonom',
      'Repo Wiki — dokumentasi otomatis',
      'Completion & edit tanpa batas',
      'Kredit chat & agent sesuai paket',
    ],
    tiers: [
      { label: 'Pro', price: 326000, priceIntl: 2000, note: '2.000 kredit' },
      { label: 'Pro+', price: 978000, priceIntl: 6000, note: 'Kuota lebih besar' },
      { label: 'Ultra', price: 3260000, priceIntl: 20000, note: '20.000 kredit' },
    ],
  },
  {
    id: 'api-deepseek',
    name: 'API Key DeepSeek',
    vendor: 'DeepSeek',
    category: 'API',
    tagline: 'Bayar per request — API termurah, ikut diskon off-peak DeepSeek.',
    description:
      'API key DeepSeek dengan tarif per request, bukan langganan mahal. Salah satu API termurah di pasar dan otomatis mengikuti diskon off-peak DeepSeek (hemat 50–75% di jam tertentu). Context window 1M token, mode thinking & non-thinking, plus context caching otomatis yang menekan biaya tiap request.',
    logo: '/logos/deepseek-white.png',
    brand: '#4d6bfe',
    price: 25000,
    period: 'paket',
    rating: 4.7,
    sold: 720,
    features: [
      'Tarif per request — mulai puluhan ribu rupiah',
      'Ikut diskon off-peak DeepSeek hemat 50–75%',
      'Context caching otomatis tekan biaya',
      'Context window 1M token, mode thinking & non-thinking',
    ],
    tiers: [
      { label: '1.000 request', price: 25000 },
      { label: '5.000 request', price: 110000, note: 'Populer' },
      { label: '10.000 request', price: 200000, note: 'Hemat' },
    ],
  },
  {
    id: 'api-openai',
    name: 'API Key OpenAI',
    vendor: 'OpenAI',
    category: 'API',
    tagline: 'Bayar per request — hemat dengan cached input & Batch API OpenAI.',
    description:
      'API key OpenAI dengan tarif per request, bukan langganan mahal. Otomatis mengikuti diskon platform OpenAI: cached input hemat hingga 90% dan Batch API hemat 50%. Ladder model lengkap dari GPT-5.4 Nano hingga GPT-5.5 Pro untuk fleksibel routing, dengan context window hingga 1.05M token.',
    logo: '/logos/openai-white.png',
    brand: '#10a37f',
    price: 45000,
    period: 'paket',
    rating: 4.8,
    sold: 540,
    features: [
      'Tarif per request — bayar sesuai pemakaian',
      'Cached input diskon hingga 90% (ikut platform)',
      'Batch API hemat 50% input & output',
      'Ladder model GPT-5.4 Nano → GPT-5.5 Pro',
    ],
    tiers: [
      { label: '1.000 request', price: 45000 },
      { label: '5.000 request', price: 200000, note: 'Populer' },
      { label: '10.000 request', price: 380000, note: 'Hemat' },
    ],
  },
  {
    id: 'leonardo-ai-pro',
    name: 'Leonardo AI Pro',
    vendor: 'Leonardo',
    category: 'AI Image',
    tagline: 'Image generation kelas pro + akses Seedance 2.0.',
    description:
      'Tier Artisan Leonardo AI (umumnya disebut Pro) dengan 25.000 kredit. AI image generation kelas pro: Phoenix, PhotoReal v2, Alchemy Refiner tanpa biaya per-use, akses model video pihak ketiga termasuk Seedance, Veo 3, Sora 2, dan Kling, plus Consistent Character Engine, LoRA training, dan Unified Canvas.',
    logo: '/logos/leonardo-white.png',
    brand: '#111111',
    price: 489000,
    period: 'bln',
    rating: 4.7,
    sold: 350,
    features: [
      'Phoenix, PhotoReal v2 & Alchemy Refiner',
      'Akses Seedance, Veo 3, Sora 2 & Kling',
      'Consistent Character Engine + LoRA training',
      'Unified Canvas: inpainting & outpainting',
    ],
    tiers: [
      { label: 'Artisan — 1 Bulan', price: 489000 },
      { label: 'Artisan — Tahunan', price: 391000, note: 'Per bln, hemat 20%' },
      { label: 'Maestro — 1 Bulan', price: 978000, note: '60.000 kredit' },
    ],
  },

  // ===== PRODUK PROMO (harga spesial Rupiah; USD otomatis sesuai kurs & bahasa) =====
  // id diawali key family agar deskripsi/fitur ikut terjemahan produk aslinya.
  {
    id: 'google-ai-pro-promo-12', name: 'Gemini Pro', vendor: 'Google', category: 'Promo',
    tagline: 'Promo spesial Gemini Pro 12 bulan — garansi penuh.', logo: '/logos/gemini-white.png', brand: '#1f6feb',
    price: 50000, priceIntl: promoCents(50000), period: '12 bln', rating: 4.9, sold: 0,
    features: ['Gemini 3 Pro penuh', 'Garansi penuh masa aktif', 'Akun private no sharing'],
    tiers: [{ label: '12 Bulan', price: 50000, priceIntl: promoCents(50000) }],
  },
  {
    id: 'google-ai-pro-promo-18', name: 'Gemini Pro', vendor: 'Google', category: 'Promo',
    tagline: 'Promo spesial Gemini Pro 18 bulan — paling hemat.', logo: '/logos/gemini-white.png', brand: '#1f6feb',
    price: 80000, priceIntl: promoCents(80000), period: '18 bln', rating: 4.9, sold: 0,
    features: ['Gemini 3 Pro penuh', 'Durasi terpanjang', 'Akun private no sharing'],
    tiers: [{ label: '18 Bulan', price: 80000, priceIntl: promoCents(80000) }],
  },
  {
    id: 'google-ai-ultra-promo', name: 'Gemini Ultra', vendor: 'Google', category: 'Promo',
    tagline: 'Promo spesial Gemini Ultra — model tertinggi Google.', logo: '/logos/gemini-white.png', brand: '#1f6feb',
    price: 250000, priceIntl: promoCents(250000), period: 'bln', rating: 4.9, sold: 0,
    features: ['Gemini 3 Ultra + Deep Think', 'Veo & alat kreatif', 'Akun private no sharing'],
    tiers: [{ label: '1 Bulan', price: 250000, priceIntl: promoCents(250000) }],
  },
  {
    id: 'chatgpt-plus-promo', name: 'ChatGPT Plus', vendor: 'OpenAI', category: 'Promo',
    tagline: 'Promo spesial ChatGPT Plus — termurah.', logo: '/logos/openai-white.png', brand: '#10a37f',
    price: 30000, priceIntl: promoCents(30000), period: 'bln', rating: 4.9, sold: 0,
    features: ['GPT-5.x + reasoning', 'Akses penuh fitur Plus', 'Akun private no sharing'],
    tiers: [{ label: '1 Bulan', price: 30000, priceIntl: promoCents(30000) }],
  },
  {
    id: 'chatgpt-pro-promo', name: 'ChatGPT Pro', vendor: 'OpenAI', category: 'Promo',
    tagline: 'Promo spesial ChatGPT Pro — mode komputasi maksimal.', logo: '/logos/openai-white.png', brand: '#10a37f',
    price: 80000, priceIntl: promoCents(80000), period: 'bln', rating: 4.9, sold: 0,
    features: ['GPT-5.5 Pro penuh', 'Akses tanpa batas wajar', 'Akun private no sharing'],
    tiers: [{ label: '1 Bulan', price: 80000, priceIntl: promoCents(80000) }],
  },
  {
    id: 'claude-pro-promo', name: 'Claude Pro', vendor: 'Anthropic', category: 'Promo',
    tagline: 'Promo spesial Claude Pro — hemat banyak.', logo: '/logos/claude-white.png', brand: '#d97757',
    price: 80000, priceIntl: promoCents(80000), period: 'bln', rating: 4.9, sold: 0,
    features: ['Semua model Claude', 'Claude Code & Projects', 'Akun private no sharing'],
    tiers: [{ label: '1 Bulan', price: 80000, priceIntl: promoCents(80000) }],
  },
  {
    id: 'claude-max-5x-promo', name: 'Claude Max 5x', vendor: 'Anthropic', category: 'Promo',
    tagline: 'Promo spesial Claude Max 5x — kapasitas 5×.', logo: '/logos/claude-white.png', brand: '#d97757',
    price: 250000, priceIntl: promoCents(250000), period: 'bln', rating: 4.9, sold: 0,
    features: ['Limit 5× Claude Pro', 'Untuk pemakaian intensif', 'Akun private no sharing'],
    tiers: [{ label: '1 Bulan', price: 250000, priceIntl: promoCents(250000) }],
  },
  {
    id: 'claude-max-20x-promo', name: 'Claude Max 20x', vendor: 'Anthropic', category: 'Promo',
    tagline: 'Promo spesial Claude Max 20x — limit tertinggi.', logo: '/logos/claude-white.png', brand: '#d97757',
    price: 1000000, priceIntl: promoCents(1000000), period: 'bln', rating: 4.9, sold: 0,
    features: ['Limit 20× Claude Pro', 'Power user kelas atas', 'Akun private no sharing'],
    tiers: [{ label: '1 Bulan', price: 1000000, priceIntl: promoCents(1000000) }],
  },
  {
    id: 'kiro-ai-promo-8000', name: 'Kiro IDE', vendor: 'Kiro', category: 'Promo',
    tagline: 'Promo spesial Kiro IDE — 8.000 kredit.', logo: '/logos/kiro-white.png', brand: '#7c3aed',
    price: 50000, priceIntl: promoCents(50000), period: 'paket', rating: 4.8, sold: 0,
    features: ['8.000 kredit agent', 'Spec-driven workflow', 'Akun private no sharing'],
    tiers: [{ label: '8.000 kredit', price: 50000, priceIntl: promoCents(50000) }],
  },
  {
    id: 'cursor-promo-pro', name: 'Cursor Pro', vendor: 'Anysphere', category: 'Promo',
    tagline: 'Promo spesial Cursor Pro Standard.', logo: '/logos/cursor-white.svg', brand: '#0f0f0f',
    price: 50000, priceIntl: promoCents(50000), period: 'bln', rating: 4.9, sold: 0,
    features: ['Tab completion super cepat', 'Agent mode lintas-file', 'Akun private no sharing'],
    tiers: [{ label: 'Standard', price: 50000, priceIntl: promoCents(50000) }],
  },
  {
    id: 'cursor-promo-proplus', name: 'Cursor Pro+', vendor: 'Anysphere', category: 'Promo',
    tagline: 'Promo spesial Cursor Pro+ — kredit 3×.', logo: '/logos/cursor-white.svg', brand: '#0f0f0f',
    price: 100000, priceIntl: promoCents(100000), period: 'bln', rating: 4.9, sold: 0,
    features: ['Kredit 3× Pro', 'Model frontier penuh', 'Akun private no sharing'],
    tiers: [{ label: 'Pro+', price: 100000, priceIntl: promoCents(100000) }],
  },
  {
    id: 'cursor-promo-ultra', name: 'Cursor Ultra', vendor: 'Anysphere', category: 'Promo',
    tagline: 'Promo spesial Cursor Ultra — multiplier 20×.', logo: '/logos/cursor-white.svg', brand: '#0f0f0f',
    price: 250000, priceIntl: promoCents(250000), period: 'bln', rating: 4.9, sold: 0,
    features: ['Multiplier 20×', 'Prioritas fitur baru', 'Akun private no sharing'],
    tiers: [{ label: 'Ultra', price: 250000, priceIntl: promoCents(250000) }],
  },

  // ===== PROMO MULTI-DURASI (flash sale): 3 Bulan / 6 Bulan / 1 Tahun =====
  {
    id: 'claude-pro-promo-multi', name: 'Claude Pro', vendor: 'Anthropic', category: 'Promo',
    tagline: 'Promo spesial Claude Pro — pilih durasi, hemat banyak.', logo: '/logos/claude-white.png', brand: '#d97757',
    price: 125000, priceIntl: promoCents(125000), period: 'bln', rating: 4.9, sold: 0,
    features: ['Semua model Claude', 'Claude Code & Projects', 'Akun private no sharing'],
    tiers: [
      { label: '3 Bulan', price: 125000, priceIntl: promoCents(125000) },
      { label: '6 Bulan', price: 250000, priceIntl: promoCents(250000) },
      { label: '1 Tahun', price: 500000, priceIntl: promoCents(500000), note: 'Paling hemat' },
    ],
  },
  {
    id: 'chatgpt-plus-promo-multi', name: 'ChatGPT Plus', vendor: 'OpenAI', category: 'Promo',
    tagline: 'Promo spesial ChatGPT Plus — pilih durasi, harga promo.', logo: '/logos/openai-white.png', brand: '#10a37f',
    price: 120000, priceIntl: promoCents(120000), period: 'bln', rating: 4.9, sold: 0,
    features: ['GPT-5.x + reasoning', 'Akses penuh fitur Plus', 'Akun private no sharing'],
    tiers: [
      { label: '3 Bulan', price: 120000, priceIntl: promoCents(120000) },
      { label: '6 Bulan', price: 220000, priceIntl: promoCents(220000) },
      { label: '1 Tahun', price: 500000, priceIntl: promoCents(500000), note: 'Paling hemat' },
    ],
  },
  {
    id: 'chatgpt-pro-promo-multi', name: 'ChatGPT Pro', vendor: 'OpenAI', category: 'Promo',
    tagline: 'Promo spesial ChatGPT Pro — komputasi maksimal, harga promo.', logo: '/logos/openai-white.png', brand: '#10a37f',
    price: 150000, priceIntl: promoCents(150000), period: 'bln', rating: 4.9, sold: 0,
    features: ['GPT-5.5 Pro penuh', 'Akses tanpa batas wajar', 'Akun private no sharing'],
    tiers: [
      { label: '3 Bulan', price: 150000, priceIntl: promoCents(150000) },
      { label: '6 Bulan', price: 250000, priceIntl: promoCents(250000) },
      { label: '1 Tahun', price: 550000, priceIntl: promoCents(550000), note: 'Paling hemat' },
    ],
  },
  {
    id: 'chatgpt-pro-promo-4bln', name: 'ChatGPT Pro', vendor: 'OpenAI', category: 'Promo',
    tagline: 'Promo spesial ChatGPT Pro 4 Bulan — komputasi maksimal, lebih hemat.', logo: '/logos/openai-white.png', brand: '#10a37f',
    price: 330000, priceIntl: promoCents(330000), period: 'bln', rating: 4.9, sold: 0,
    features: ['GPT-5.5 Pro penuh', 'Akses tanpa batas wajar', 'Akun private no sharing'],
    tiers: [
      { label: '4 Bulan', price: 330000, priceIntl: promoCents(330000) },
    ],
  },
  {
    id: 'claude-max-5x-promo-multi', name: 'Claude Max 5x', vendor: 'Anthropic', category: 'Promo',
    tagline: 'Promo spesial Claude Max 5x — kapasitas 5×, pilih durasi.', logo: '/logos/claude-white.png', brand: '#d97757',
    price: 250000, priceIntl: promoCents(250000), period: 'bln', rating: 5.0, sold: 0,
    features: ['Limit 5× Claude Pro', 'Untuk pemakaian intensif', 'Akun private no sharing'],
    tiers: [
      { label: '3 Bulan', price: 250000, priceIntl: promoCents(250000) },
      { label: '6 Bulan', price: 800000, priceIntl: promoCents(800000) },
      { label: '1 Tahun', price: 1000000, priceIntl: promoCents(1000000), note: 'Paling hemat' },
    ],
  },
  // ===== HIGGSFIELD AI (flash sale, akun private, diskon 80%) — per plan =====
  {
    id: 'higgsfield-ai-starter', name: 'Higgsfield Starter', vendor: 'Higgsfield', category: 'Promo',
    tagline: 'Promo spesial Higgsfield AI Starter — akun private, diskon 80%.',
    description: 'Platform AI video & gambar generatif — bikin video sinematik, animasi karakter, dan iklan produk dengan kontrol penuh. Paket Starter cocok untuk pemula: ±300 kredit per bulan, semua tool dasar video & gambar, hasil tanpa watermark. Akun private, tanpa sharing.',
    logo: '/logos/higgsfield-white.png', brand: '#0f0f0f', badge: 'STARTER', badgeColor: '#0284c7',
    price: 250000, priceIntl: 1500, flashPrice: 50000, flashPriceIntl: 300, period: 'bln', rating: 4.7, sold: 0, estimate: '10–20 menit',
    features: ['Higgsfield Starter penuh', '±300 kredit/bulan', 'Semua tool video & gambar', 'Akun private no sharing'],
    tiers: [{ label: '1 Bulan', price: 50000, priceIntl: 300, note: 'Diskon 80%' }],
  },
  {
    id: 'higgsfield-ai-plus', name: 'Higgsfield Plus', vendor: 'Higgsfield', category: 'Promo',
    tagline: 'Promo spesial Higgsfield AI Plus — akun private, diskon 80%.',
    description: 'Platform AI video & gambar generatif — bikin video sinematik, animasi karakter, dan iklan produk dengan kontrol penuh. Paket Plus: ±1.000 kredit per bulan, semua model video & gambar, dan akses prioritas saat trafik tinggi. Akun private, tanpa sharing.',
    logo: '/logos/higgsfield-white.png', brand: '#0f0f0f', badge: 'PLUS', badgeColor: '#b45309',
    price: 650000, priceIntl: 3900, flashPrice: 130000, flashPriceIntl: 780, period: 'bln', rating: 4.8, sold: 0, estimate: '10–20 menit',
    features: ['Higgsfield Plus penuh', '±1.000 kredit/bulan', 'Semua model video & gambar', 'Akun private no sharing'],
    tiers: [{ label: '1 Bulan', price: 130000, priceIntl: 780, note: 'Diskon 80%' }],
  },
  {
    id: 'higgsfield-ai-ultra', name: 'Higgsfield Ultra', vendor: 'Higgsfield', category: 'Promo',
    tagline: 'Promo spesial Higgsfield AI Ultra — akun private, diskon 80%.',
    description: 'Platform AI video & gambar generatif — bikin video sinematik, animasi karakter, dan iklan produk dengan kontrol penuh. Paket Ultra untuk pro: ±3.000 kredit per bulan, akses prioritas tertinggi, fitur eksperimen & model baru lebih dulu, plus semua tool video & gambar. Akun private, tanpa sharing.',
    logo: '/logos/higgsfield-white.png', brand: '#0f0f0f', badge: 'ULTRA', badgeColor: '#7c3aed',
    price: 1650000, priceIntl: 9900, flashPrice: 330000, flashPriceIntl: 1980, period: 'bln', rating: 4.9, sold: 0, estimate: '10–20 menit',
    features: ['Higgsfield Ultra penuh', '±3.000 kredit/bulan', 'Akses prioritas tertinggi', 'Akun private no sharing'],
    tiers: [{ label: '1 Bulan', price: 330000, priceIntl: 1980, note: 'Diskon 80%' }],
  },
]

// Katalog final: harga internasional terisi, lalu dipecah per tier jadi produk terpisah.
export const products = FAMILIES.flatMap((p) => splitFamily(withIntl(p)))

export const formatIDR = (n) =>
  'Rp ' + n.toLocaleString('id-ID')

// Terapkan diskon toko (persen) ke sebuah harga. Mengembalikan harga setelah diskon.
export const applyDiscount = (price, percent) =>
  percent > 0 ? Math.round((price * (100 - percent)) / 100) : price

export const getProduct = (id) => products.find((p) => p.id === id)

export const categories = [...new Set(products.map((p) => p.category))]

// ===== Flash Sale =====
// Flash sale = produk PROMO (kategori 'Promo'), bersifat PERMANEN.
// Hitung mundur hanya untuk urgensi marketing — saat habis pun produk TIDAK
// dihapus, tetap tampil. Harga "normal" (coret) diturunkan dari harga promo
// supaya terlihat diskon besar; harga jual sebenarnya = harga promo.
const flashOf = (p, i) => {
  const mult = 3 + ((i * 3) % 6) * 0.2 // 3.0–4.0 → diskon ~67–75%
  const salePrice = Number.isFinite(Number(p.flashPrice)) && Number(p.flashPrice) > 0 ? Number(p.flashPrice) : p.price
  const salePriceIntl = Number.isFinite(Number(p.flashPriceIntl)) && Number(p.flashPriceIntl) > 0 ? Number(p.flashPriceIntl) : p.priceIntl
  // Jika ada harga asli eksplisit (price > harga flash sale), pakai itu sebagai harga coret
  // supaya diskon akurat (mis. harga asli Rp650.000, flash Rp130.000 → diskon 80%).
  const originalPrice = p.price > salePrice ? p.price : Math.round((salePrice * mult) / 5000) * 5000
  const fallbackSold = 300 + ((i * 53) % 501) // 300–800 (total terjual, acak stabil)
  const fallbackLeft = 10 + ((i * 17) % 41) // 10–50 (sisa stok, acak stabil)
  const hasManagedStock = Number.isFinite(p.stock) && p.stock >= -1
  const stock = hasManagedStock ? p.stock : fallbackSold + fallbackLeft
  const sold = hasManagedStock ? Math.max(0, Number(p.sold) || 0) : fallbackSold
  const safeTiers = Array.isArray(p.tiers) && p.tiers.length
    ? p.tiers
    : [{ label: p.period || 'Produk', price: p.price, priceIntl: p.priceIntl }]
  return {
    ...p,
    tiers: safeTiers,
    discount: Math.max(0, Math.round((1 - salePrice / originalPrice) * 100)),
    stock,
    stockOut: !!p.stockOut,
    sold,
    originalPrice,
    originalPriceIntl: promoCents(originalPrice),
    salePrice,
    salePriceIntl,
  }
}

// Terapkan transformasi flash sale ke daftar produk apa pun (statis ATAU dari DB).
// Produk masuk flash sale jika flag flashSale aktif; untuk katalog statis/DB lama
// yang belum punya flag, fallback ke kategori 'Promo' (perilaku lama).
const inFlashSale = (p) =>
  p.flashSale === true || (p.flashSale == null && p.category === 'Promo')
export const flashFrom = (list) => (list || []).filter(inFlashSale).map(flashOf)

export const flashSale = flashFrom(products)

// Target berakhirnya flash sale: blok 6 jam berikutnya — selalu di masa depan & stabil.
export const getSaleEndTime = () => {
  const now = new Date()
  const end = new Date(now)
  const block = 6 * 60 * 60 * 1000
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const elapsed = now.getTime() - startOfDay
  const nextBlock = (Math.floor(elapsed / block) + 1) * block
  end.setTime(startOfDay + nextBlock)
  return end
}
