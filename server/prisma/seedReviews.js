import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Persona reviewer: nama + bahasa + gender ──────────────────────────────────
// 60% Indonesia (60 orang) + 40% luar negeri (40 orang: en/zh/vi/ja/ms/hi/de/ru)
// gender 'm'|'f' menentukan folder foto randomuser.me (indeks unik).
const PERSONAS = [
  // ── Indonesia (60) ──
  ['Budi Santoso', 'id', 'm'], ['Rizki Pratama', 'id', 'm'], ['Dewi Lestari', 'id', 'f'],
  ['Agus Setiawan', 'id', 'm'], ['Putri Maharani', 'id', 'f'], ['Andi Wijaya', 'id', 'm'],
  ['Siti Rahayu', 'id', 'f'], ['Bayu Saputra', 'id', 'm'], ['Nabila Azzahra', 'id', 'f'],
  ['Fajar Ramadhan', 'id', 'm'], ['Indah Permata', 'id', 'f'], ['Doni Kurniawan', 'id', 'm'],
  ['Rina Wati', 'id', 'f'], ['Eko Prasetyo', 'id', 'm'], ['Maya Sari', 'id', 'f'],
  ['Hendra Gunawan', 'id', 'm'], ['Tika Andini', 'id', 'f'], ['Yoga Firmansyah', 'id', 'm'],
  ['Lia Kartika', 'id', 'f'], ['Dimas Aditya', 'id', 'm'], ['Ratna Dewi', 'id', 'f'],
  ['Gilang Ramadhan', 'id', 'm'], ['Ayu Lestari', 'id', 'f'], ['Farhan Maulana', 'id', 'm'],
  ['Sinta Wulandari', 'id', 'f'], ['Rangga Saputra', 'id', 'm'], ['Nurul Hidayah', 'id', 'f'],
  ['Adit Nugroho', 'id', 'm'], ['Citra Ayu', 'id', 'f'], ['Ilham Fauzi', 'id', 'm'],
  ['Kartika Sari', 'id', 'f'], ['Rizky Hidayat', 'id', 'm'], ['Mega Puspita', 'id', 'f'],
  ['Bagus Setiawan', 'id', 'm'], ['Vina Meliana', 'id', 'f'], ['Joko Susilo', 'id', 'm'],
  ['Wulan Dwi', 'id', 'f'], ['Arif Hidayat', 'id', 'm'], ['Salsa Nabila', 'id', 'f'],
  ['Bima Arya', 'id', 'm'], ['Nadia Safitri', 'id', 'f'], ['Raka Aditya', 'id', 'm'],
  ['Zahra Aulia', 'id', 'f'], ['Dimas Prayoga', 'id', 'm'], ['Rani Maharani', 'id', 'f'],
  ['Fikri Ramadhan', 'id', 'm'], ['Intan Permatasari', 'id', 'f'], ['Galih Pratama', 'id', 'm'],
  ['Dinda Ayu', 'id', 'f'], ['Rizky Ananda', 'id', 'm'], ['Tiara Maharani', 'id', 'f'],
  ['Andre Firmansyah', 'id', 'm'], ['Nadia Ayu', 'id', 'f'], ['Yusuf Maulana', 'id', 'm'],
  ['Syifa Aulia', 'id', 'f'], ['Rahmat Hidayat', 'id', 'm'], ['Diah Ayu', 'id', 'f'],
  ['Fadhil Ramadhan', 'id', 'm'], ['Melati Putri', 'id', 'f'], ['Rizwan Hakim', 'id', 'm'],
  // ── English (10) ──
  ['Jake Miller', 'en', 'm'], ['Emily Carter', 'en', 'f'], ['Liam Walker', 'en', 'm'],
  ['Sophia Bennett', 'en', 'f'], ['Noah Reed', 'en', 'm'], ['Olivia Brooks', 'en', 'f'],
  ['Ethan Hayes', 'en', 'm'], ['Ava Morgan', 'en', 'f'], ['Mason Cooper', 'en', 'm'],
  ['Chloe Turner', 'en', 'f'],
  // ── China (10) ──
  ['王伟', 'zh', 'm'], ['李娜', 'zh', 'f'], ['张敏', 'zh', 'f'], ['刘洋', 'zh', 'm'],
  ['陈静', 'zh', 'f'], ['杨帆', 'zh', 'm'], ['黄磊', 'zh', 'm'], ['周婷', 'zh', 'f'],
  ['吴俊', 'zh', 'm'], ['徐丽', 'zh', 'f'],
  // ── Vietnam (8) ──
  ['Nguyễn Văn An', 'vi', 'm'], ['Trần Thị Hương', 'vi', 'f'], ['Lê Minh Tuấn', 'vi', 'm'],
  ['Phạm Thu Hà', 'vi', 'f'], ['Hoàng Văn Nam', 'vi', 'm'], ['Vũ Thị Lan', 'vi', 'f'],
  ['Đặng Quốc Bảo', 'vi', 'm'], ['Bùi Thị Mai', 'vi', 'f'],
  // ── Japan (6) ──
  ['田中翔太', 'ja', 'm'], ['佐藤美咲', 'ja', 'f'], ['鈴木大輔', 'ja', 'm'], ['高橋愛', 'ja', 'f'],
  ['伊藤健一', 'ja', 'm'], ['渡辺さくら', 'ja', 'f'],
  // ── Malay (2) ──
  ['Ahmad Faiz', 'ms', 'm'], ['Nur Aisyah', 'ms', 'f'],
  // ── Hindi (2) ──
  ['Arjun Sharma', 'hi', 'm'], ['Priya Patel', 'hi', 'f'],
  // ── German (1) ──
  ['Jonas Weber', 'de', 'm'],
  // ── Russian (1) ──
  ['Алексей Соколов', 'ru', 'm'],
]

// ── Komentar detail ala manusia asli ──────────────────────────────────────────
// Multi-kalimat, bahasa santai, kadang typo/singkatan, pakai emoji ganda/tripel.
// {product} diganti nama produk saat seed.
const COMMENTS = {
  id: [
    'langganan {product} udah 3 bulan jalan, aman terus ga pernah kena masalah. pengirimannya juga cepet banget, ga nyangka bisa semudah ini 😂😂',
    'awalnya ragu takut ketipu, ternyata asli beneran. {product} langsung aktif, login lancar jaya. mantap pokoknya 👍👍',
    'akunnya ori bukan abal-abal, udah gw pake buat kerja tiap hari. worth it banget buat harga segini, ga nyesel 🔥🔥',
    'prosesnya cepet bgt, bayar langsung dikirim ga pake lama. {product} sesuai deskripsi, makasih gan 😄',
    'csnya ramah & fast respon, pas akun sempet bermasalah langsung diganti tanpa ribet. recommended seller sih ini ❤️❤️',
    'murah meriah tapi kualitas premium, {product} jalan mulus. udah order 2x disini dan selalu puas 😍',
    'ga nyangka beli {product} di harga segini bisa dapet kualitas sebagus ini. gokil lah pokoknya 😂🔥',
    'baru pertama beli disini, tadinya mikir lama mau cobain. ternyata aman, {product} langsung nyala. bakal repeat order 😁👍',
    'pengiriman kilat ga sampe 5 menit akun udah masuk email. {product} private, aman dipake pribadi 🥰',
    'langganan 2 bulan ini, {product} stabil terus. garansi juga bagus, pernah kena error langsung dibantu sampe beres 👍',
    'harga jauh lebih murah dari official, fungsi 100% sama. {product} recommended buat yang mau hemat 😎🔥',
    'sempet telat dikit tadi, tapi dikasih info terus sama adminnya. hasilnya memuaskan, {product} normal semua 😊',
    'udah 3x order disini, selalu aman & cepet. {product} bikin kerjaan gw lebih gampang, thanks admin 🙏🙏',
    'dibanding beli langsung di official, ini jauh lebih hemat. {product} ga ada bedanya, mantul 👍👍',
    'adminnya sabar bgt jelasin step by step, cocok buat yang baru pertama kali kayak gw. akhirnya beres juga 😊🙏',
    'akun {product} langsung bisa dipake, ga ada ribet aktivasi. recommended pokoknya buat yang mau cepet 🔥',
    'udah langganan 4 bulan, ga pernah zonk. {product} selalu sesuai sama yang dijanjikan 😁',
    'tempat beli akun langganan gw sekarang, {product} selalu keisi on time. trusted seller 100% 👍',
    'murah, cepet, aman. tiga-tiganya dapet disini. {product} recommended banget 😂😂',
    'pas checkout ragu, pas nerima akun langsung senyum sendiri. {product} mulus, thanks bang 🙏🔥',
    'kualitas {product} nya premium beneran, ga kayak yang murahan. worth every rupiah 😍😍',
    'sempet takut kena scam, tapi ternyata legit. udah 2 minggu pake {product} aman terus 😅😂',
    'fast respon & fast delivery, adminnya juga baik. {product} recommended buat kalian semua 👍',
    'bukan yang paling murah, tapi paling worth it menurut gw. {product} nya awet & aman 😎',
    'gw butuh {product} buat kerjaan, untung nemu toko ini. hemat banyak, kualitas oke 😁🔥',
    'pengalaman beli paling mulus sejauh ini. {product} langsung aktif, ga pake drama 😂👍',
    'sudah repeat order 3x, semuanya lancar. {product} emang paling oke di sini ❤️',
    'awalnya cuma coba-coba, ternyata jadi langganan. {product} bagus & adminnya fast respon 😊',
    'garansi beneran dipake, akun {product} bermasalah langsung diganti baru. mantap pokoknya 🙏',
    'harga bersahabat buat kantong mahasiswa, {product} jalan normal. makasih banyak 🙏🙏',
    'dari semua toko yang pernah gw coba, ini paling fast & reliable. {product} recommended 🔥🔥',
    'lucu banget pas checkout sempet bingung, tapi dibantu admin sampe beres. {product} nya mantap 😂🙏',
    'akun {product} udah gw pake buat streaming & kerja, lancar jaya. ga ada komplain 👍',
    'langganan 6 bulan, {product} stabil terus. ini toko langganan gw sekarang 😁',
    'kadang telat dikit sih, tapi kualitas {product} nya ga pernah mengecewakan 😊',
    'beli {product} buat hadiah adek gw, dia puas banget. makasih toko 👍😊',
    'transaksi aman, {product} sesuai pesanan. ga ada yang perlu dikeluhin 😄',
    'cuma modal coba, eh ternyata {product} nya bagus banget. bakal balik lagi 😂🔥',
    'admin fast respon 24 jam, pernah tanya jam 2 pagi masih dibales. top lah 👍🙏',
    'akun {product} private, ga sharing. aman buat dipake kerjaan serius 🔥',
    'murah tapi bukan berarti murahan, {product} kualitasnya premium. puas 😍',
    'prosesnya simple banget, ga ribet. {product} langsung bisa dipake, makasih 🙏',
    'udah 5x order disini, ga pernah kecewa. {product} emang juara 👍🔥',
    'tempat beli {product} paling oke, harga miring kualitas juara. recommended 😎',
    'biasanya gw gampang ragu, tapi toko ini bikin percaya. {product} aman & cepet 😁',
    'akunnya langsung aktif, ga perlu nunggu lama. {product} sesuai ekspektasi 👍',
    'sangat membantu buat kerjaan gw, {product} nya lancar terus. makasih banyak 🙏😊',
    'dari harga segini dapet {product} sekualitas ini, gila sih. mantap 🔥🔥',
    'repeat order lagi, karena emang puas sama pelayanan & kualitas {product} ❤️',
    'pelayanan oke, {product} oke, harga oke. lengkap semua disini 😂👍',
  ],
  en: [
    "got my {product} within 5 minutes, super smooth. legit seller, would recommend 🙌",
    "was skeptical at first but it's 100% legit. {product} works perfectly, no issues at all 👍",
    "been using {product} for 2 months now and everything is flawless. great value for money 💯",
    "way cheaper than official and works exactly the same. no complaints whatsoever 😄",
    "fast delivery, friendly support, and the {product} works great. easy 5 stars ⭐⭐⭐",
    "account is private and secure, been using it daily for work. totally worth it 🔥",
    "had a tiny hiccup but support fixed it right away. {product} is solid, thanks team 🙏",
    "honestly didn't expect it to be this smooth. {product} delivered as promised 😎",
    "super fast, the {product} was ready almost instantly. great experience overall 👍",
    "ordered a few times now and it's always reliable. this is my go-to store now 🔥",
    "support was a bit slow to reply but they sorted it out in the end. {product} works fine 😊",
    "first time buying here and definitely not disappointed. {product} is legit 👍",
    "saved a ton compared to paying full price. {product} works just like the official one 💯",
    "legit, fast and cheap — what more can you ask for. {product} recommended 🙌",
    "delivery was basically instant and the {product} account is in perfect condition 😄",
    "really helped with my work, {product} runs smoothly every day. thanks a lot 🙏",
    "everything as promised, solid seller. {product} is worth every cent ⭐⭐⭐",
    "no issues so far, already a month into using {product}. highly recommend 👍",
    "quick replies and super easy process. the {product} works like a charm 😎",
    "came across this store by chance and glad I did. {product} is amazing value 🔥",
    "the support team is super responsive, answered all my questions fast. {product} is great 🙌",
    "used the warranty once and they replaced the {product} account without any hassle 👍",
    "honestly the best deal I've found for {product}. smooth transaction all the way 💯",
    "bought {product} for my brother and he loves it. thanks for the great service 😊",
    "very reliable store, {product} still going strong after 3 months. would buy again 🔥",
  ],
  zh: [
    '五分钟就到账了，{product}直接能用，靠谱 👍',
    '一开始担心被骗，结果是真货，{product}用得很顺 😄',
    '用了两个月一点问题都没有，性价比超高 💯',
    '比官方便宜太多了，功能一模一样，满意 😊',
    '发货快客服态度也好，{product}没毛病，五星好评 ⭐⭐⭐',
    '账号是独享的，工作用很放心，推荐 🔥',
    '客服回复很快，问题一下就解决了，赞 👍',
    '基本秒到账，{product}质量没得说 😎',
    '买过好几次了，一直很稳定，老顾客了 🙌',
    '这个价格能买到正版真是没想到，太值了 😂',
    '交易很顺利和描述一样，{product}好用，谢谢老板 🙏',
    '客服很耐心，问什么都会快速回复，体验很好 😊',
    '物超所值，用了快一个月很满意，会回购 💯',
    '比原价省了不少钱，{product}完全够用，推荐 👍',
    '刚开始有点担心，现在完全放心了，{product}很好用 🔥',
  ],
  vi: [
    'chưa tới 5 phút đã có {product}, giao nhanh dễ sợ luôn 👍',
    'lúc đầu hơi lo bị lừa nhưng đúng là thật, {product} xài mượt lắm 😄',
    'dùng 2 tháng rồi không lỗi gì cả, giá này quá ổn 💯',
    'rẻ hơn official nhiều mà xài y chang, ưng ghê 😊',
    'giao nhanh hỗ trợ nhiệt tình, {product} 5 sao ⭐⭐⭐',
    'tài khoản riêng không dùng chung, yên tâm làm việc 🔥',
    'bị lỗi nhẹ shop fix liền, quá ok, cảm ơn shop 🙏',
    'vào tài khoản gần như tức thì, {product} đúng như mô tả 👍',
    'mua mấy lần rồi lần nào cũng ổn, tin tưởng lắm 🙌',
    'giá này mà có {product} xịn thì hết nước chấm 😂',
    'tiết kiệm được khối tiền so với mua thẳng, đáng lắm 💯',
    'cskh tư vấn nhiệt tình trả lời nhanh, {product} dùng ngon 😊',
  ],
  ja: [
    '5分くらいで届きました、{product}ちゃんと使えます 👍',
    '最初は不安でしたが本物でした、満足してます 😄',
    '2ヶ月使ってますが全く問題ないです、コスパ最高 💯',
    '公式よりかなり安いのに同じように使えて満足 😊',
    '発送早いしサポートも丁寧、{product}星5つ ⭐⭐⭐',
    '専用アカウントなので仕事でも安心、おすすめ 🔥',
    'ちょっとトラブったけどすぐ対応してくれた、最高 👍',
    'ほぼ即時に届きました、{product}説明通りでした 🙏',
    '何回か買ってるけど毎回安定してます、リピート確定 😎',
    'この値段で正規が手に入るとは思わなかった、感激 😂',
  ],
  ms: [
    'proses laju, {product} terus boleh guna. memang berbaloi 👍',
    'awal tu risau kena tipu, rupanya betul. {product} elok je 😄',
    'dah langgan 2 bulan, takde masalah langsung. mantap 💯',
    'murah dari official, fungsi sama je. puas hati 😊',
    'support cepat layan, {product} memang recommended 🔥',
    'beli beberapa kali dah, semuanya lancar. trusted 🙌',
  ],
  hi: [
    '5 minute me account mil gaya, {product} bilkul kaam kar raha hai 👍',
    'pehle dar raha tha fraud ka, par bilkul original hai. badhiya 😄',
    '2 mahine se use kar raha hoon, koi dikkat nahi. value for money 💯',
    'official se bahut sasta aur same kaam, kya baat hai 😊',
    'fast delivery aur support bhi accha, {product} top hai 🔥',
    'kayi baar order kiya, hamesha reliable. recommended 🙌',
  ],
  de: [
    'Konto kam in 5 Minuten, {product} funktioniert einwandfrei 👍',
    'war erst skeptisch, aber alles ist echt. {product} läuft super 😄',
    'viel günstiger als offiziell und gleiche Qualität, top 💯',
    'schnelle Lieferung und freundlicher Support, {product} empfehlenswert 🔥',
  ],
  ru: [
    'аккаунт пришёл за 5 минут, {product} работает отлично 👍',
    'сначала боялся обмана, но всё честно. {product} супер 😄',
    'гораздо дешевле оригинала, качество то же, топ 💯',
    'быстрая доставка и хорошая поддержка, рекомендую 🔥',
  ],
}

// Emoji ekstra buat variasi (ganda/tripel) — nempel di sebagian komentar.
const EMOJI_EXTRA = [
  '😂😂', '😂😂😂', '😭😭', '😭😭😭', '🔥🔥', '🔥🔥🔥', '👍👍', '❤️❤️',
  '😍😍', '😁😁', '🙏🙏', '🤣🤣', '😅😅', '🥰🥰', '💯💯', '😎😎',
]

const rnd = (n) => Math.floor(Math.random() * n)
const pick = (arr) => arr[rnd(arr.length)]
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]] } return a }

// Rating realistis: mayoritas 5, sebagian 4, sedikit 3.
const weightedRating = () => { const r = Math.random(); return r < 0.62 ? 5 : r < 0.9 ? 4 : 3 }
const pastDate = () => new Date(Date.now() - rnd(160) * 86400_000 - rnd(86400_000))

// Bangun komentar: isi {product} + sesekali emoji ekstra di akhir.
function buildComment(pool, productName) {
  let c = pick(pool)
  if (c.includes('{product}')) c = c.replaceAll('{product}', productName || 'produk ini')
  if (Math.random() < 0.35) c = c + ' ' + pick(EMOJI_EXTRA)
  return c
}

async function main() {
  // 1) Upsert persona sebagai user (idempoten), kelompokkan ID vs luar negeri.
  const portraitIdx = { m: 1, f: 1 }
  const indonesian = []
  const foreign = []
  for (let i = 0; i < PERSONAS.length; i++) {
    const [name, lang, gender] = PERSONAS[i]
    const idx = portraitIdx[gender]++
    const avatar = `https://randomuser.me/api/portraits/${gender === 'f' ? 'women' : 'men'}/${idx}.jpg`
    const email = `reviewer-${i}@reviews.local`
    const u = await prisma.user.upsert({
      where: { email },
      update: { name, picture: avatar },
      create: { email, name, picture: avatar, role: 'USER' },
    })
    const p = { ...u, lang, avatar }
    if (lang === 'id') indonesian.push(p)
    else foreign.push(p)
  }

  // 2) Hapus ulasan seed lama (dari persona ini) agar idempoten.
  await prisma.review.deleteMany({ where: { userId: { in: [...indonesian, ...foreign].map((u) => u.id) } } })

  // 3) Untuk tiap produk → 15–50 ulasan (dalam rentang 10–100), 60% ID / 40% luar.
  //    Pakai createMany per produk (batch) biar cepat di DB remote.
  const productList = await prisma.product.findMany({ select: { id: true, name: true } })
  let total = 0
  for (const p of productList) {
    const n = 15 + rnd(36) // 15..50
    const nId = Math.round(n * 0.6)
    const reviewers = [
      ...shuffle(indonesian).slice(0, nId),
      ...shuffle(foreign).slice(0, n - nId),
    ]
    const used = new Set()
    const rows = []
    for (const u of reviewers) {
      const pool = COMMENTS[u.lang] || COMMENTS.en
      let comment = buildComment(pool, p.name)
      let guard = 0
      while (used.has(comment) && guard++ < 10) comment = buildComment(pool, p.name)
      used.add(comment)
      rows.push({
        productId: p.id, userId: u.id, name: u.name, avatar: u.avatar,
        rating: weightedRating(), comment, createdAt: pastDate(),
      })
    }
    if (rows.length) {
      await prisma.review.createMany({ data: rows, skipDuplicates: true })
      total += rows.length
    }
  }
  console.log(`Seed ulasan selesai: ${total} ulasan untuk ${productList.length} produk (${indonesian.length} persona ID + ${foreign.length} luar negeri).`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
