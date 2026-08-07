import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Persona reviewer: nama + bahasa + foto profil (randomuser.me) ──────────────
// gender 'm'|'f' menentukan folder foto, idx = nomor foto (0-99) yang unik.
const PERSONAS = [
  // Indonesia
  ['Budi Santoso', 'id', 'm'], ['Rizki Pratama', 'id', 'm'], ['Dewi Lestari', 'id', 'f'],
  ['Agus Setiawan', 'id', 'm'], ['Putri Maharani', 'id', 'f'], ['Andi Wijaya', 'id', 'm'],
  ['Siti Rahayu', 'id', 'f'], ['Bayu Saputra', 'id', 'm'], ['Nabila Az-zahra', 'id', 'f'],
  ['Fajar Ramadhan', 'id', 'm'], ['Indah Permata', 'id', 'f'], ['Doni Kurniawan', 'id', 'm'],
  ['Rina Wati', 'id', 'f'], ['Eko Prasetyo', 'id', 'm'], ['Maya Sari', 'id', 'f'], ['Hendra Gunawan', 'id', 'm'],
  // English
  ['Jake Miller', 'en', 'm'], ['Emily Carter', 'en', 'f'], ['Liam Walker', 'en', 'm'],
  ['Sophia Bennett', 'en', 'f'], ['Noah Reed', 'en', 'm'], ['Olivia Brooks', 'en', 'f'],
  ['Ethan Hayes', 'en', 'm'], ['Ava Morgan', 'en', 'f'], ['Mason Cooper', 'en', 'm'],
  ['Mia Foster', 'en', 'f'], ['Lucas Gray', 'en', 'm'], ['Chloe Turner', 'en', 'f'],
  ['Daniel Price', 'en', 'm'], ['Grace Sullivan', 'en', 'f'], ['Ryan Cole', 'en', 'm'], ['Hannah Ross', 'en', 'f'],
  // China
  ['王伟', 'zh', 'm'], ['李娜', 'zh', 'f'], ['张敏', 'zh', 'f'], ['刘洋', 'zh', 'm'],
  ['陈静', 'zh', 'f'], ['杨帆', 'zh', 'm'], ['黄磊', 'zh', 'm'], ['周婷', 'zh', 'f'],
  ['吴俊', 'zh', 'm'], ['徐丽', 'zh', 'f'], ['孙浩', 'zh', 'm'], ['朱琳', 'zh', 'f'],
  ['马涛', 'zh', 'm'], ['胡燕', 'zh', 'f'], ['郭鹏', 'zh', 'm'], ['林夏', 'zh', 'f'],
  // Vietnam
  ['Nguyễn Văn An', 'vi', 'm'], ['Trần Thị Hương', 'vi', 'f'], ['Lê Minh Tuấn', 'vi', 'm'],
  ['Phạm Thu Hà', 'vi', 'f'], ['Hoàng Văn Nam', 'vi', 'm'], ['Vũ Thị Lan', 'vi', 'f'],
  ['Đặng Quốc Bảo', 'vi', 'm'], ['Bùi Thị Mai', 'vi', 'f'], ['Đỗ Văn Hùng', 'vi', 'm'],
  ['Ngô Thị Thảo', 'vi', 'f'], ['Dương Minh Khoa', 'vi', 'm'], ['Lý Thị Ngọc', 'vi', 'f'],
  ['Phan Văn Đức', 'vi', 'm'], ['Võ Thị Linh', 'vi', 'f'], ['Đinh Quang Huy', 'vi', 'm'], ['Trịnh Thu Trang', 'vi', 'f'],
  // Japan
  ['田中翔太', 'ja', 'm'], ['佐藤美咲', 'ja', 'f'], ['鈴木大輔', 'ja', 'm'], ['高橋愛', 'ja', 'f'],
  ['伊藤健一', 'ja', 'm'], ['渡辺さくら', 'ja', 'f'], ['山本拓也', 'ja', 'm'], ['中村優子', 'ja', 'f'],
  ['小林直樹', 'ja', 'm'], ['加藤陽菜', 'ja', 'f'], ['吉田亮', 'ja', 'm'], ['山田真央', 'ja', 'f'],
  ['佐々木涼', 'ja', 'm'], ['松本ゆい', 'ja', 'f'], ['井上和也', 'ja', 'm'], ['木村彩', 'ja', 'f'],
]

// Komentar gaya manusia biasa (santai, bukan baku, kadang typo/lowercase).
// Fokus pengalaman beli akun digital: cepat, legit, murah, garansi, respon.
const COMMENTS = {
  id: [
    'mantap sih ini, prosesnya cepet bgt ga sampe 10 menit udah masuk',
    'awalnya ragu takut kena tipu, ternyata legit. makasih bang',
    'udah langganan 3 bulan aman2 aja, lanjut terus dah',
    'harga miring kualitas oke, recommended pokoknya',
    'fast respon, adminnya ramah juga. bintang 5 deh',
    'akun normal ga ada masalah, login lancar jaya',
    'telat dikit tadi tp akhirnya masuk juga, overall puas',
    'murah meriah, dibanding beli langsung jauh lebih hemat',
    'garansinya kepake kemaren akun bermasalah langsung diganti, top',
    'ga nyangka semurah ini bisa dapet akun ori, gokil',
    'pelayanan cepat barang sesuai deskripsi, thanks gan',
    'transaksi ke sekian kali tetep aman, langganan disini terus',
    'respon agak lama tp hasilnya memuaskan kok',
    'baru pertama beli disini dan ga kecewa, bakal balik lagi',
    'akun aktif sesuai durasi, ga ada drama. mantul',
    'cuss langsung aktif ga ribet, recommended seller',
    'worth it bgt harganya, premium beneran bukan abal2',
    'sempet error pas login tp dibantu sampe beres, makasih adminnya',
    'lebih murah dari official fungsi sama persis, puas',
    'pengiriman kilat ga sampe 5 menit udh dpt akunnya',
    'udah 2x order disini lancar terus, trusted lah',
    'akunnya private bukan sharing, aman dipake kerja',
    'ngebantu bgt buat kerjaan, harganya bersahabat',
    'oke punya sesuai ekspektasi, lanjutkan bos',
    'csnya responsif bgt, pertanyaan dijawab cepet',
  ],
  en: [
    'works perfectly, got my account in like 5 mins. legit seller',
    'was a bit skeptical at first but its 100% legit, thanks!',
    'been using it for 2 months now, no issues at all',
    'way cheaper than official and works the same, no complaints',
    'fast delivery and friendly support, easy 5 stars',
    'account works fine, login was smooth no problems',
    'took a little while but worth the wait, happy customer',
    'honestly didnt expect it to be this smooth, recommended',
    'great price for premium quality, will buy again',
    'had a small issue and support fixed it right away, top notch',
    'super fast, the account was ready almost instantly',
    'ordered a few times now and its always reliable',
    'support was a bit slow to reply but sorted it out in the end',
    'first time buying here and not disappointed at all',
    'private account not shared, safe to use for work',
    'cant believe how cheap this is for an original account',
    'smooth transaction, item exactly as described. cheers',
    'saved me a lot of money compared to paying full price',
    'legit, fast and cheap, what more can you ask for',
    'account stayed active the whole duration, no drama',
    'delivery was basically instant, didnt even have to wait',
    'really helpful for my work and great value too',
    'everything as promised, solid seller 👍',
    'no issues so far, already a month in',
    'quick reply and super easy process, thanks a lot',
  ],
  zh: [
    '很快就到账了，五分钟不到，靠谱',
    '一开始有点担心怕被骗，结果是真的，谢谢老板',
    '已经用了两个月了一点问题都没有',
    '比官方便宜太多了功能一样，满意',
    '发货快客服态度也好，五星好评',
    '账号正常登录很顺畅，没毛病',
    '等了一小会儿不过值了，挺满意的',
    '没想到这么顺利，推荐给大家',
    '价格实惠质量也不错，下次还来',
    '之前有点小问题客服马上就解决了，赞一个',
    '基本秒到账，几乎不用等',
    '买过好几次了一直都很稳',
    '客服回复稍微慢了点不过最后还是解决了',
    '第一次买没有失望，会回购的',
    '是独享号不是共享的，工作用很安全',
    '这个价格能买到正版真是没想到',
    '交易很顺利和描述一样，谢谢',
    '比原价省了不少钱',
    '又便宜又快又靠谱，没得挑',
    '账号整个周期都正常，没有幺蛾子',
    '物超所值，强烈推荐',
    '客服很耐心，问什么都很快回',
  ],
  vi: [
    'nhanh thật chưa tới 5 phút đã có tài khoản, uy tín',
    'lúc đầu hơi lo bị lừa nhưng đúng là thật, cảm ơn shop',
    'dùng 2 tháng rồi mà không lỗi gì cả',
    'rẻ hơn official nhiều mà xài y chang, ưng',
    'giao nhanh hỗ trợ nhiệt tình, 5 sao',
    'tài khoản đăng nhập mượt không vấn đề gì',
    'chờ chút xíu nhưng đáng, hài lòng nha',
    'không ngờ mượt vậy luôn, recommend',
    'giá ổn chất lượng tốt, lần sau ghé tiếp',
    'bị lỗi nhẹ shop fix liền, quá ok',
    'vào tài khoản gần như tức thì',
    'mua mấy lần rồi lần nào cũng ổn',
    'shop rep hơi chậm tí nhưng cuối cùng cũng xong',
    'lần đầu mua mà không thất vọng, sẽ quay lại',
    'tài khoản riêng không phải dùng chung, yên tâm làm việc',
    'giá này mà có acc xịn thì hết nước chấm',
    'giao dịch suôn sẻ đúng như mô tả, cảm ơn',
    'tiết kiệm được khối tiền so với mua thẳng',
    'rẻ nhanh uy tín, còn gì bằng',
    'tài khoản dùng đủ hạn không drama gì hết',
    'đáng đồng tiền, sẽ giới thiệu bạn bè',
    'cskh tư vấn nhiệt tình trả lời nhanh',
  ],
  ja: [
    '5分くらいで届きました、ちゃんとしてます',
    '最初は不安でしたが本物でした、ありがとうございます',
    '2ヶ月使ってますが全く問題ないです',
    '公式よりかなり安いのに同じように使えて満足',
    '発送早いしサポートも丁寧、星5つ',
    'アカウント普通にログインできて問題なしでした',
    '少し待ちましたが待つ価値ありでした',
    'こんなにスムーズだと思わなかった、おすすめ',
    '安いのに品質もいい、また買います',
    'ちょっとトラブったけどすぐ対応してくれた、最高',
    'ほぼ即時に届きました',
    '何回か買ってるけど毎回安定してます',
    '返信は少し遅めでしたが最終的に解決しました',
    '初めて買いましたが全然問題なかったです',
    '共有じゃなく専用アカウントなので仕事でも安心',
    'この値段で正規が手に入るとは思わなかった',
    '取引スムーズで説明通りでした、感謝',
    '正規で買うよりかなり節約できました',
    '安い早い安心、文句なしです',
    '期間中ずっと使えてトラブルなしでした',
    'コスパ最高、リピートします',
    'サポートの対応が早くて助かりました',
  ],
}

const rnd = (n) => Math.floor(Math.random() * n)
const pick = (arr) => arr[rnd(arr.length)]
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]] } return a }

// Bobot bahasa: mayoritas Indonesia, China, English; Vietnam & Jepang lebih sedikit.
const LANG_WEIGHT = { id: 3, zh: 3, en: 3, vi: 1, ja: 1 }
// Ambil n reviewer berbeda dengan bias bahasa (sampling tanpa pengembalian).
function pickReviewers(all, n) {
  const pool = [...all]
  const out = []
  while (out.length < n && pool.length) {
    const totalW = pool.reduce((s, u) => s + (LANG_WEIGHT[u.lang] || 1), 0)
    let r = Math.random() * totalW
    let idx = 0
    for (; idx < pool.length - 1; idx++) { r -= (LANG_WEIGHT[pool[idx].lang] || 1); if (r <= 0) break }
    out.push(pool.splice(idx, 1)[0])
  }
  return out
}
// Rating realistis: mayoritas 5, sebagian 4, sedikit 3.
const weightedRating = () => { const r = Math.random(); return r < 0.62 ? 5 : r < 0.9 ? 4 : 3 }
const pastDate = () => new Date(Date.now() - rnd(160) * 86400_000 - rnd(86400_000))

async function main() {
  // 1) Upsert persona sebagai user (idempoten), simpan id + foto.
  const portraitIdx = { m: 1, f: 1 }
  const users = []
  for (let i = 0; i < PERSONAS.length; i++) {
    const [name, lang, gender] = PERSONAS[i]
    const idx = portraitIdx[gender]++
    const avatar = `https://randomuser.me/api/portraits/${gender === 'f' ? 'women' : 'men'}/${idx}.jpg`
    const email = `reviewer-${i}@reviews.local`
    const u = await prisma.user.upsert({
      where: { email }, update: { name, picture: avatar },
      create: { email, name, picture: avatar, role: 'USER' },
    })
    users.push({ ...u, lang, avatar })
  }

  // 2) Hapus ulasan seed lama (dari persona ini) agar idempoten.
  await prisma.review.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } })

  // 3) Untuk tiap produk → 8-13 ulasan dari persona acak (bahasa campur).
  const productList = await prisma.product.findMany({ select: { id: true } })
  let total = 0
  for (const p of productList) {
    const n = 8 + rnd(6) // 8..13
    const reviewers = pickReviewers(users, n)
    const usedComments = new Set()
    for (const u of reviewers) {
      const poolLang = COMMENTS[u.lang] ? u.lang : 'en'
      let comment = pick(COMMENTS[poolLang])
      let guard = 0
      while (usedComments.has(comment) && guard++ < 8) comment = pick(COMMENTS[poolLang])
      usedComments.add(comment)
      await prisma.review.create({
        data: {
          productId: p.id, userId: u.id, name: u.name, avatar: u.avatar,
          rating: weightedRating(), comment, createdAt: pastDate(),
        },
      })
      total++
    }
  }
  console.log(`Seed ulasan selesai: ${total} ulasan untuk ${productList.length} produk (${users.length} persona, 5 bahasa).`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
