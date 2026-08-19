#!/usr/bin/env python3
"""
EVOLUSIAI BOT v4
- Saldo per Telegram user ID (tanpa login) — data PERSISTEN di bot/data (bukan /tmp)
- Check-in harian 7-hari sinkron dengan website (Rp 300/hari, bonus Rp 2.000 hari ke-7)
- Flash Sale pagination + varian durasi (1 bln / 3 bln / 6 bln / 1 thn)
- Stok habis per-user: produk 30.000–80.000 auto-refund ke Saldo (sama seperti server)
- i18n 9 bahasa: id, en, zh, ja, ru, ms, hi, de, vi
- UI profesional: bold typography, clean layout
"""

import os, sys, json, time, io, logging, hashlib
from datetime import date, timedelta
from threading import Lock

import telebot
from telebot import types
import requests
import qrcode

# ═══ CONFIG ═══
def _load_env(path):
    """Muat variabel env dari file .env (tanpa dependensi eksternal)."""
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except Exception:
        pass

_load_env(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
if not BOT_TOKEN:
    raise SystemExit("BOT_TOKEN tidak diset. Buat bot/.env berisi BOT_TOKEN=...")

API_BASE  = "https://www.upbit.my.id/api"
STORE_URL = "https://www.upbit.my.id"

BOT_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(BOT_DIR, "data")
LOG_FILE   = os.path.join(BOT_DIR, "upbit-bot.log")
LOCK_FILE  = "/tmp/upbit-bot.lock"
STATE_FILE = os.path.join(DATA_DIR, "upbit-bot-state.json")
BAL_FILE   = os.path.join(DATA_DIR, "upbit-bot-balance.json")
# Path lama (harus dibersihkan/dimigrasi — /tmp hilang saat reboot)
LEGACY_STATE_FILE = "/tmp/upbit-bot-state.json"
LEGACY_BAL_FILE   = "/tmp/upbit-bot-balance.json"

os.makedirs(DATA_DIR, exist_ok=True)

# ═══ ATURAN BISNIS (sinkron dengan server) ═══
# Produk 30.000–80.000 IDR → simulasi stok habis → refund otomatis ke Saldo
STOCK_OUT_MIN = 30000
STOCK_OUT_MAX = 80000
MIN_WITHDRAW  = 310000          # min. total transaksi untuk tarik saldo
CHECKIN_REWARD = 300            # Rp/hari
CHECKIN_BONUS  = 2000           # bonus hari ke-7
CHECKIN_CYCLE  = 7

# ═══ Logging ═══
MSG_LOG_FILE = os.path.join(DATA_DIR, "upbit-bot-messages.log")
BANNED_FILE  = os.path.join(DATA_DIR, "upbit-bot-banned.json")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"), logging.StreamHandler()])
log = logging.getLogger("upbit-bot")

# ═══ SPAM PROTECTION ═══
SPAM_KEYWORDS = [
    "пробива", "БОТЫ", "боты", "Пробива", "ФИО", "Госномеру", "Паспорт",
    "Поиск Человека", "spam", "scam", "buy followers", "boost telegram",
    "@adm", "бесплатно", "заработок", "заработка", "реферал",
    "telegram.org/dl", "free money", "claim reward",
]

def is_spam(text):
    """Cek apakah teks mengandung keyword spam. Return (bool, reason)."""
    if not text:
        return False, ""
    t = text.lower()
    for kw in SPAM_KEYWORDS:
        if kw.lower() in t:
            return True, kw
    return False, ""

def load_banned():
    """Load daftar user yang di-ban."""
    return _read_json(BANNED_FILE, {})

def is_banned(uid):
    """Cek apakah user di-ban."""
    banned = load_banned()
    return str(uid) in banned

def ban_user(uid, reason="spam"):
    """Ban user dan simpan ke file."""
    banned = load_banned()
    banned[str(uid)] = {"banned_at": time.strftime("%Y-%m-%d %H:%M:%S"), "reason": reason}
    _write_json(BANNED_FILE, banned)
    log.warning(f"BANNED user {uid} — reason: {reason}")

def log_msg(uid, username, first_name, text):
    """Log pesan user ke file khusus."""
    try:
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        name = username or first_name or "?"
        preview = (text or "")[:200].replace("\n", "\\n")
        with open(MSG_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"{ts} | uid={uid} | {name} | {preview}\n")
    except Exception:
        pass

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")

# ═══ PAYMENT ═══
QRIS_STATIC = "00020101021126610016ID.CO.SHOPEE.WWW01189360091800231770190208231770190303UMI51440014ID.CO.QRIS.WWW0215ID10265313881830303UMI5204581753033605802ID5911UPbit Store6013JAKARTA PUSAT61051052062070703A0163044EF7"

def crc16(s):
    crc = 0xffff
    for c in s:
        crc ^= ord(c) << 8
        crc = ((crc << 1) ^ 0x1021) if (crc & 0x8000) else (crc << 1)
        crc &= 0xffff
    return f"{crc:04X}"

def build_qris(amt):
    a = str(max(0, int(amt)))
    base = QRIS_STATIC[:-8]
    # Ubah point-of-initiation ke 12 (dynamic) supaya nominal ter-carry
    base = base[:10] + "12" + base[12:]
    f = "54" + f"{len(a):02d}" + a
    base = base.replace("5802ID", f + "5802ID")
    return (base + "6304") + crc16(base + "6304")

CRYPTO = [
    {"id": "bnb", "symbol": "BNB",  "address": "0x02fd0906c6f873f35259889d7396f46b92a24aee", "rate": 9_650_000, "dec": 4},
    {"id": "usdt", "symbol": "USDT", "address": "0x02fd0906c6f873f35259889d7396f46b92a24aee", "rate": 16_300, "dec": 2},
]

# ═══ i18n ═══
LANGS = {"id": "Indonesia", "en": "English", "zh": "中文", "ja": "日本語", "ru": "Русский",
         "ms": "Melayu", "hi": "हिन्दी", "de": "Deutsch", "vi": "Tiếng Việt"}

I18N = {
"id": {
 "welcome":"<b>EVOLUSIAI</b>\nMarketplace produk digital\n\n<i>Pilih bahasa / Choose language:</i>",
 "lang_set":"Bahasa disimpan: {lang}","menu_hint":"Pilih menu di bawah:","main_menu":"<b>Menu Utama</b>",
 "back":"« Kembali","next_page":"Lihat lainnya →","prev_page":"« Sebelumnya",
 "flash_loading":"<i>Memuat Flash Sale...</i>","flash_fail":"Gagal memuat produk. Coba lagi nanti ya.",
 "catalog_loading":"<i>Memuat katalog...</i>","catalog_fail":"Gagal memuat. Coba lagi.",
 "catalog_total":"Total: {n} produk","catalog_pick":"<i>Pilih kategori:</i>","pick_item":"Pilih:","not_found":"Tidak ditemukan",
 "pick_duration":"<b>Pilih durasi:</b>","price":"Harga: {price}","pay_method":"<i>Metode pembayaran:</i>",
 "pkg_info":"Paket: {label} · {price}",
 "qris_title":"<b>QRIS · {amount}</b>",
 "qris_scan":"Scan QR di atas untuk membayar.\nSetelah transfer, klik <b>Cek Pembayaran</b>.",
 "check_pay":"Cek Pembayaran","check_msg":"Memeriksa...","checking":"<b>Memeriksa pembayaran</b>\n{bar} {pct}%",
 "crypto_title":"<b>CRYPTO</b>","crypto_total":"Total: {amount}","crypto_pick":"<i>Pilih aset:</i>",
 "crypto_send":"Kirim ke:\n<code>{address}</code>\n\nNetwork: BNB Smart Chain (BEP-20)\n\n<i>Balas chat ini dengan TX Hash kamu.</i>",
 "tx_short":"<i>TX Hash terlalu pendek (min. 10 karakter)</i>",
 "tx_ok":"<b>TX Hash diterima</b>\nKlik tombol <b>Cek Pembayaran</b> di atas untuk melanjutkan.",
 "tx_first":"Masukkan TX Hash dulu",
 "stock_title":"<b>Stok Habis</b>",
 "stock_msg":"Sayang sekali, stok <b>{product}</b> baru saja habis.\n\nSaldo <b>{amount}</b> sudah masuk ke <b>Saldo</b> kamu.\nCek halaman Saldo untuk refund & tarik dana.\n\n<i>Min. transaksi {min} untuk bisa tarik saldo.</i>",
 "order_title":"<b>Pesanan Dibuat</b>",
 "order_msg":"ID: <code>{id}</code>\nProduk: {product} · {price}\nStatus: <b>Diproses</b>\n\n<i>Detail akses dikirim ke email setelah dikonfirmasi.</i>",
 "saldo_title":"<b>SALDO</b>","saldo_avail":"Saldo tersedia: <b>{amount}</b>",
 "saldo_spent":"Total transaksi: <b>{amount}</b>","saldo_streak":"Check-in streak: <b>{n} hari</b>",
 "saldo_min":"Min. tarik saldo: {amount}","saldo_can":"Status tarik: ✅ Bisa","saldo_need":"Status tarik: Kurang {amount}",
 "checkin_btn":"Check-in","checkin_done":"Sudah check-in hari ini!",
 "checkin_ok":"+{amount}! Streak: {n} hari","checkin_bonus":"+{amount}! Bonus hari ke-{n} 🎉",
 "checkin_msg":"<i>Check-in berhasil! +{amount}</i>",
 "website_about":"<i>Marketplace produk digital premium.\nAI Assistant, Software, Tools.</i>",
 "help_title":"<b>BANTUAN</b>",
 "help_steps":"1. Pilih produk dari Flash Sale / Katalog\n2. Pilih paket & metode bayar (QRIS / Crypto)\n3. Bayar & klik Cek Pembayaran\n4. Akses dikirim ke email",
 "help_refund":"<b>Refund:</b> otomatis jika stok habis","help_withdraw":"<b>Tarik Saldo:</b> min. transaksi {min}",
 "help_checkin":"<b>Check-in:</b> {reward}/hari di menu Saldo",
 "help_contact":"<b>Kontak:</b>\nWA: 087797127865\nEmail: support@upbit.my.id",
 "use_menu":"Gunakan menu di bawah untuk navigasi.","open_web":"Buka Website","stock_out_tag":"Stok Habis",
 "flash_footer":"{items} produk · {groups} grup · Hal {cur}/{total}",
 "pick_lang":"<i>Pilih bahasa / Choose language:</i>",
},
"en": {
 "welcome":"<b>EVOLUSIAI</b>\nDigital products marketplace\n\n<i>Choose your language:</i>",
 "lang_set":"Language saved: {lang}","menu_hint":"Choose a menu below:","main_menu":"<b>Main Menu</b>",
 "back":"« Back","next_page":"See more →","prev_page":"« Previous",
 "flash_loading":"<i>Loading Flash Sale...</i>","flash_fail":"Failed to load products. Try again later.",
 "catalog_loading":"<i>Loading catalog...</i>","catalog_fail":"Failed to load. Try again.",
 "catalog_total":"Total: {n} products","catalog_pick":"<i>Choose a category:</i>","pick_item":"Choose:","not_found":"Not found",
 "pick_duration":"<b>Choose duration:</b>","price":"Price: {price}","pay_method":"<i>Payment method:</i>",
 "pkg_info":"Package: {label} · {price}",
 "qris_title":"<b>QRIS · {amount}</b>",
 "qris_scan":"Scan the QR code above to pay.\nAfter transferring, tap <b>Check Payment</b>.",
 "check_pay":"Check Payment","check_msg":"Checking...","checking":"<b>Checking payment</b>\n{bar} {pct}%",
 "crypto_title":"<b>CRYPTO</b>","crypto_total":"Total: {amount}","crypto_pick":"<i>Choose an asset:</i>",
 "crypto_send":"Send to:\n<code>{address}</code>\n\nNetwork: BNB Smart Chain (BEP-20)\n\n<i>Reply to this chat with your TX Hash.</i>",
 "tx_short":"<i>TX Hash too short (min. 10 characters)</i>",
 "tx_ok":"<b>TX Hash received</b>\nTap <b>Check Payment</b> above to continue.",
 "tx_first":"Enter your TX Hash first",
 "stock_title":"<b>Out of Stock</b>",
 "stock_msg":"Unfortunately, <b>{product}</b> just ran out of stock.\n\nYour <b>{amount}</b> has been added to your <b>Balance</b>.\nCheck the Balance page for refund & withdrawal.\n\n<i>Min. {min} total transactions to withdraw.</i>",
 "order_title":"<b>Order Created</b>",
 "order_msg":"ID: <code>{id}</code>\nProduct: {product} · {price}\nStatus: <b>Processing</b>\n\n<i>Access details will be sent to your email once confirmed.</i>",
 "saldo_title":"<b>BALANCE</b>","saldo_avail":"Available balance: <b>{amount}</b>",
 "saldo_spent":"Total transactions: <b>{amount}</b>","saldo_streak":"Check-in streak: <b>{n} days</b>",
 "saldo_min":"Min. withdrawal: {amount}","saldo_can":"Withdraw status: ✅ Eligible","saldo_need":"Withdraw status: Need {amount} more",
 "checkin_btn":"Check-in","checkin_done":"Already checked in today!",
 "checkin_ok":"+{amount}! Streak: {n} days","checkin_bonus":"+{amount}! Day-{n} bonus 🎉",
 "checkin_msg":"<i>Check-in successful! +{amount}</i>",
 "website_about":"<i>Premium digital products marketplace.\nAI Assistant, Software, Tools.</i>",
 "help_title":"<b>HELP</b>",
 "help_steps":"1. Pick a product from Flash Sale / Catalog\n2. Choose package & payment (QRIS / Crypto)\n3. Pay & tap Check Payment\n4. Access is sent to your email",
 "help_refund":"<b>Refund:</b> automatic if out of stock","help_withdraw":"<b>Withdraw:</b> min. {min} transactions",
 "help_checkin":"<b>Check-in:</b> {reward}/day in Balance menu",
 "help_contact":"<b>Contact:</b>\nWA: 087797127865\nEmail: support@upbit.my.id",
 "use_menu":"Use the menu below to navigate.","open_web":"Open Website","stock_out_tag":"Out of Stock",
 "flash_footer":"{items} products · {groups} groups · Page {cur}/{total}",
 "pick_lang":"<i>Choose your language:</i>",
},
"zh": {
 "welcome":"<b>EVOLUSIAI</b>\n数字产品商城\n\n<i>选择语言:</i>",
 "lang_set":"语言已保存: {lang}","menu_hint":"请选择下方菜单:","main_menu":"<b>主菜单</b>",
 "back":"« 返回","next_page":"查看更多 →","prev_page":"« 上一页",
 "flash_loading":"<i>正在加载闪购...</i>","flash_fail":"加载商品失败，请稍后再试。",
 "catalog_loading":"<i>正在加载目录...</i>","catalog_fail":"加载失败，请重试。",
 "catalog_total":"共 {n} 个商品","catalog_pick":"<i>请选择分类:</i>","pick_item":"选择:","not_found":"未找到",
 "pick_duration":"<b>选择时长:</b>","price":"价格: {price}","pay_method":"<i>支付方式:</i>",
 "pkg_info":"套餐: {label} · {price}",
 "qris_title":"<b>QRIS · {amount}</b>",
 "qris_scan":"扫描上方二维码支付。\n转账后点击 <b>检查付款</b>。",
 "check_pay":"检查付款","check_msg":"检查中...","checking":"<b>正在检查付款</b>\n{bar} {pct}%",
 "crypto_title":"<b>加密货币</b>","crypto_total":"总计: {amount}","crypto_pick":"<i>选择资产:</i>",
 "crypto_send":"发送至:\n<code>{address}</code>\n\n网络: BNB Smart Chain (BEP-20)\n\n<i>请回复此聊天发送您的 TX Hash。</i>",
 "tx_short":"<i>TX Hash 太短（最少 10 个字符）</i>",
 "tx_ok":"<b>TX Hash 已收到</b>\n点击上方 <b>检查付款</b> 继续。",
 "tx_first":"请先输入 TX Hash",
 "stock_title":"<b>已售罄</b>",
 "stock_msg":"很遗憾，<b>{product}</b> 刚刚售罄。\n\n您的 <b>{amount}</b> 已存入<b>余额</b>。\n请查看余额页面了解退款与提现。\n\n<i>累计消费满 {min} 才可提现。</i>",
 "order_title":"<b>订单已创建</b>",
 "order_msg":"ID: <code>{id}</code>\n商品: {product} · {price}\n状态: <b>处理中</b>\n\n<i>确认后访问详情将发送至您的邮箱。</i>",
 "saldo_title":"<b>余额</b>","saldo_avail":"可用余额: <b>{amount}</b>",
 "saldo_spent":"累计消费: <b>{amount}</b>","saldo_streak":"连续签到: <b>{n} 天</b>",
 "saldo_min":"最低提现: {amount}","saldo_can":"提现状态: ✅ 可提现","saldo_need":"提现状态: 还差 {amount}",
 "checkin_btn":"签到","checkin_done":"今天已经签到过了！",
 "checkin_ok":"+{amount}! 连续 {n} 天","checkin_bonus":"+{amount}! 第{n}天奖励 🎉",
 "checkin_msg":"<i>签到成功！+{amount}</i>",
 "website_about":"<i>高端数字产品商城。\nAI 助手、软件、工具。</i>",
 "help_title":"<b>帮助</b>",
 "help_steps":"1. 从闪购/目录选择商品\n2. 选择套餐与支付方式（QRIS / Crypto）\n3. 支付并点击检查付款\n4. 访问详情发送至邮箱",
 "help_refund":"<b>退款：</b>售罄时自动退款","help_withdraw":"<b>提现：</b>累计消费满 {min}",
 "help_checkin":"<b>签到：</b>每天 {reward}，在余额菜单",
 "help_contact":"<b>联系：</b>\nWA: 087797127865\nEmail: support@upbit.my.id",
 "use_menu":"请使用下方菜单导航。","open_web":"打开网站","stock_out_tag":"已售罄",
 "flash_footer":"共 {items} 商品 · {groups} 组 · 第{cur}/{total}页",
 "pick_lang":"<i>选择语言:</i>",
},
"ja": {
 "welcome":"<b>EVOLUSIAI</b>\nデジタル商品マーケットプレイス\n\n<i>言語を選択:</i>",
 "lang_set":"言語を保存しました: {lang}","menu_hint":"下のメニューを選択:","main_menu":"<b>メインメニュー</b>",
 "back":"« 戻る","next_page":"もっと見る →","prev_page":"« 前へ",
 "flash_loading":"<i>フラッシュセール読み込み中...</i>","flash_fail":"商品の読み込みに失敗しました。後でもう一度お試しください。",
 "catalog_loading":"<i>カタログ読み込み中...</i>","catalog_fail":"読み込みに失敗しました。もう一度お試しください。",
 "catalog_total":"合計 {n} 商品","catalog_pick":"<i>カテゴリを選択:</i>","pick_item":"選択:","not_found":"見つかりません",
 "pick_duration":"<b>期間を選択:</b>","price":"価格: {price}","pay_method":"<i>支払い方法:</i>",
 "pkg_info":"パッケージ: {label} · {price}",
 "qris_title":"<b>QRIS · {amount}</b>",
 "qris_scan":"上のQRコードをスキャンして支払います。\n送金後、<b>支払い確認</b>をタップ。",
 "check_pay":"支払い確認","check_msg":"確認中...","checking":"<b>支払いを確認中</b>\n{bar} {pct}%",
 "crypto_title":"<b>暗号通貨</b>","crypto_total":"合計: {amount}","crypto_pick":"<i>資産を選択:</i>",
 "crypto_send":"送金先:\n<code>{address}</code>\n\nネットワーク: BNB Smart Chain (BEP-20)\n\n<i>このチャットにTX Hashを返信してください。</i>",
 "tx_short":"<i>TX Hashが短すぎます（最低10文字）</i>",
 "tx_ok":"<b>TX Hashを受信しました</b>\n上の<b>支払い確認</b>をタップして続行。",
 "tx_first":"先にTX Hashを入力してください",
 "stock_title":"<b>在庫切れ</b>",
 "stock_msg":"残念ながら、<b>{product}</b>は在庫切れになりました。\n\n<b>{amount}</b>は<b>残高</b>に入金されました。\n残高ページで返金・出金をご確認ください。\n\n<i>出金には累計{min}以上の取引が必要です。</i>",
 "order_title":"<b>注文を作成しました</b>",
 "order_msg":"ID: <code>{id}</code>\n商品: {product} · {price}\nステータス: <b>処理中</b>\n\n<i>確認後、アクセス詳細をメールで送信します。</i>",
 "saldo_title":"<b>残高</b>","saldo_avail":"利用可能残高: <b>{amount}</b>",
 "saldo_spent":"取引合計: <b>{amount}</b>","saldo_streak":"チェックイン連続: <b>{n} 日</b>",
 "saldo_min":"最低出金: {amount}","saldo_can":"出金ステータス: ✅ 可能","saldo_need":"出金ステータス: あと {amount}",
 "checkin_btn":"チェックイン","checkin_done":"今日はすでにチェックイン済みです！",
 "checkin_ok":"+{amount}! 連続 {n} 日","checkin_bonus":"+{amount}! {n}日目ボーナス 🎉",
 "checkin_msg":"<i>チェックイン成功！+{amount}</i>",
 "website_about":"<i>プレミアムデジタル商品マーケットプレイス。\nAIアシスタント、ソフトウェア、ツール。</i>",
 "help_title":"<b>ヘルプ</b>",
 "help_steps":"1. フラッシュセール/カタログから商品を選択\n2. パッケージと支払い方法を選択（QRIS / Crypto）\n3. 支払い後、支払い確認をタップ\n4. アクセス詳細をメールで送信",
 "help_refund":"<b>返金：</b>在庫切れ時は自動","help_withdraw":"<b>出金：</b>累計取引 {min} 以上",
 "help_checkin":"<b>チェックイン：</b>毎日 {reward}（残高メニュー）",
 "help_contact":"<b>連絡先：</b>\nWA: 087797127865\nEmail: support@upbit.my.id",
 "use_menu":"下のメニューを使用して移動してください。","open_web":"ウェブサイトを開く","stock_out_tag":"在庫切れ",
 "flash_footer":"{items} 商品 · {groups} グループ · {cur}/{total}ページ",
 "pick_lang":"<i>言語を選択:</i>",
},
"ru": {
 "welcome":"<b>EVOLUSIAI</b>\nМаркетплейс цифровых товаров\n\n<i>Выберите язык:</i>",
 "lang_set":"Язык сохранён: {lang}","menu_hint":"Выберите пункт меню ниже:","main_menu":"<b>Главное меню</b>",
 "back":"« Назад","next_page":"Показать ещё →","prev_page":"« Назад",
 "flash_loading":"<i>Загрузка Flash Sale...</i>","flash_fail":"Не удалось загрузить товары. Попробуйте позже.",
 "catalog_loading":"<i>Загрузка каталога...</i>","catalog_fail":"Ошибка загрузки. Попробуйте снова.",
 "catalog_total":"Всего: {n} товаров","catalog_pick":"<i>Выберите категорию:</i>","pick_item":"Выберите:","not_found":"Не найдено",
 "pick_duration":"<b>Выберите срок:</b>","price":"Цена: {price}","pay_method":"<i>Способ оплаты:</i>",
 "pkg_info":"Пакет: {label} · {price}",
 "qris_title":"<b>QRIS · {amount}</b>",
 "qris_scan":"Отсканируйте QR-код выше для оплаты.\nПосле перевода нажмите <b>Проверить оплату</b>.",
 "check_pay":"Проверить оплату","check_msg":"Проверка...","checking":"<b>Проверка оплаты</b>\n{bar} {pct}%",
 "crypto_title":"<b>КРИПТО</b>","crypto_total":"Итого: {amount}","crypto_pick":"<i>Выберите актив:</i>",
 "crypto_send":"Отправьте на:\n<code>{address}</code>\n\nСеть: BNB Smart Chain (BEP-20)\n\n<i>Ответьте в этот чат вашим TX Hash.</i>",
 "tx_short":"<i>TX Hash слишком короткий (мин. 10 символов)</i>",
 "tx_ok":"<b>TX Hash получен</b>\nНажмите <b>Проверить оплату</b> выше, чтобы продолжить.",
 "tx_first":"Сначала введите TX Hash",
 "stock_title":"<b>Нет в наличии</b>",
 "stock_msg":"К сожалению, <b>{product}</b> только что закончился.\n\nВаши <b>{amount}</b> зачислены на <b>баланс</b>.\nПроверьте страницу баланса для возврата и вывода.\n\n<i>Для вывода нужны покупки от {min}.</i>",
 "order_title":"<b>Заказ создан</b>",
 "order_msg":"ID: <code>{id}</code>\nТовар: {product} · {price}\nСтатус: <b>Обработка</b>\n\n<i>Данные доступа будут отправлены на email после подтверждения.</i>",
 "saldo_title":"<b>БАЛАНС</b>","saldo_avail":"Доступно: <b>{amount}</b>",
 "saldo_spent":"Всего покупок: <b>{amount}</b>","saldo_streak":"Серия чек-инов: <b>{n} дней</b>",
 "saldo_min":"Мин. вывод: {amount}","saldo_can":"Статус вывода: ✅ Доступно","saldo_need":"Статус вывода: Нужно ещё {amount}",
 "checkin_btn":"Чек-ин","checkin_done":"Уже отмечались сегодня!",
 "checkin_ok":"+{amount}! Серия: {n} дней","checkin_bonus":"+{amount}! Бонус дня {n} 🎉",
 "checkin_msg":"<i>Чек-ин успешен! +{amount}</i>",
 "website_about":"<i>Премиальный маркетплейс цифровых товаров.\nAI-ассистенты, софт, инструменты.</i>",
 "help_title":"<b>ПОМОЩЬ</b>",
 "help_steps":"1. Выберите товар в Flash Sale / Каталоге\n2. Выберите пакет и способ оплаты (QRIS / Crypto)\n3. Оплатите и нажмите Проверить оплату\n4. Доступ отправлен на email",
 "help_refund":"<b>Возврат:</b> автоматически при отсутствии стока","help_withdraw":"<b>Вывод:</b> покупки от {min}",
 "help_checkin":"<b>Чек-ин:</b> {reward}/день в меню Баланс",
 "help_contact":"<b>Контакты:</b>\nWA: 087797127865\nEmail: support@upbit.my.id",
 "use_menu":"Используйте меню ниже для навигации.","open_web":"Открыть сайт","stock_out_tag":"Нет в наличии",
 "flash_footer":"{items} товаров · {groups} групп · Стр. {cur}/{total}",
 "pick_lang":"<i>Выберите язык:</i>",
},
"ms": {
 "welcome":"<b>EVOLUSIAI</b>\nMarketplace produk digital\n\n<i>Pilih bahasa / Choose language:</i>",
 "lang_set":"Bahasa disimpan: {lang}","menu_hint":"Pilih menu di bawah:","main_menu":"<b>Menu Utama</b>",
 "back":"« Kembali","next_page":"Lihat lagi →","prev_page":"« Sebelumnya",
 "flash_loading":"<i>Memuat Flash Sale...</i>","flash_fail":"Gagal memuat produk. Cuba lagi nanti ya.",
 "catalog_loading":"<i>Memuat katalog...</i>","catalog_fail":"Gagal memuat. Cuba lagi.",
 "catalog_total":"Jumlah: {n} produk","catalog_pick":"<i>Pilih kategori:</i>","pick_item":"Pilih:","not_found":"Tidak ditemui",
 "pick_duration":"<b>Pilih tempoh:</b>","price":"Harga: {price}","pay_method":"<i>Kaedah pembayaran:</i>",
 "pkg_info":"Pakej: {label} · {price}",
 "qris_title":"<b>QRIS · {amount}</b>",
 "qris_scan":"Imbas QR di atas untuk bayar.\nSelepas pindahan, klik <b>Semak Pembayaran</b>.",
 "check_pay":"Semak Pembayaran","check_msg":"Menyemak...","checking":"<b>Menyemak pembayaran</b>\n{bar} {pct}%",
 "crypto_title":"<b>CRYPTO</b>","crypto_total":"Jumlah: {amount}","crypto_pick":"<i>Pilih aset:</i>",
 "crypto_send":"Hantar ke:\n<code>{address}</code>\n\nNetwork: BNB Smart Chain (BEP-20)\n\n<i>Balas chat ini dengan TX Hash anda.</i>",
 "tx_short":"<i>TX Hash terlalu pendek (min. 10 aksara)</i>",
 "tx_ok":"<b>TX Hash diterima</b>\nKlik <b>Semak Pembayaran</b> di atas untuk teruskan.",
 "tx_first":"Masukkan TX Hash dahulu",
 "stock_title":"<b>Stok Habis</b>",
 "stock_msg":"Malangnya, stok <b>{product}</b> baru sahaja habis.\n\nSaldo <b>{amount}</b> telah masuk ke <b>Saldo</b> anda.\nSemak halaman Saldo untuk refund & pengeluaran.\n\n<i>Min. transaksi {min} untuk tarik saldo.</i>",
 "order_title":"<b>Pesanan Dibuat</b>",
 "order_msg":"ID: <code>{id}</code>\nProduk: {product} · {price}\nStatus: <b>Diproses</b>\n\n<i>Detail akses dihantar ke email selepas disahkan.</i>",
 "saldo_title":"<b>SALDO</b>","saldo_avail":"Saldo tersedia: <b>{amount}</b>",
 "saldo_spent":"Jumlah transaksi: <b>{amount}</b>","saldo_streak":"Check-in streak: <b>{n} hari</b>",
 "saldo_min":"Min. tarik saldo: {amount}","saldo_can":"Status tarik: ✅ Boleh","saldo_need":"Status tarik: Kurang {amount}",
 "checkin_btn":"Check-in","checkin_done":"Sudah check-in hari ini!",
 "checkin_ok":"+{amount}! Streak: {n} hari","checkin_bonus":"+{amount}! Bonus hari ke-{n} 🎉",
 "checkin_msg":"<i>Check-in berjaya! +{amount}</i>",
 "website_about":"<i>Marketplace produk digital premium.\nAI Assistant, Software, Tools.</i>",
 "help_title":"<b>BANTUAN</b>",
 "help_steps":"1. Pilih produk dari Flash Sale / Katalog\n2. Pilih pakej & kaedah bayar (QRIS / Crypto)\n3. Bayar & klik Semak Pembayaran\n4. Akses dihantar ke email",
 "help_refund":"<b>Refund:</b> automatik jika stok habis","help_withdraw":"<b>Tarik Saldo:</b> min. transaksi {min}",
 "help_checkin":"<b>Check-in:</b> {reward}/hari di menu Saldo",
 "help_contact":"<b>Kontak:</b>\nWA: 087797127865\nEmail: support@upbit.my.id",
 "use_menu":"Guna menu di bawah untuk navigasi.","open_web":"Buka Laman Web","stock_out_tag":"Stok Habis",
 "flash_footer":"{items} produk · {groups} kumpulan · Hal {cur}/{total}",
 "pick_lang":"<i>Pilih bahasa / Choose language:</i>",
},
"hi": {
 "welcome":"<b>EVOLUSIAI</b>\nडिजिटल उत्पाद मार्केटप्लेस\n\n<i>भाषा चुनें:</i>",
 "lang_set":"भाषा सेव हो गई: {lang}","menu_hint":"नीचे मेनू चुनें:","main_menu":"<b>मुख्य मेनू</b>",
 "back":"« वापस","next_page":"और देखें →","prev_page":"« पिछला",
 "flash_loading":"<i>फ्लैश सेल लोड हो रहा है...</i>","flash_fail":"उत्पाद लोड नहीं हो सके। बाद में फिर कोशिश करें।",
 "catalog_loading":"<i>कैटलॉग लोड हो रहा है...</i>","catalog_fail":"लोड नहीं हुआ। फिर कोशिश करें।",
 "catalog_total":"कुल: {n} उत्पाद","catalog_pick":"<i>श्रेणी चुनें:</i>","pick_item":"चुनें:","not_found":"नहीं मिला",
 "pick_duration":"<b>अवधि चुनें:</b>","price":"कीमत: {price}","pay_method":"<i>भुगतान विधि:</i>",
 "pkg_info":"पैकेज: {label} · {price}",
 "qris_title":"<b>QRIS · {amount}</b>",
 "qris_scan":"भुगतान के लिए ऊपर QR स्कैन करें।\nभुगतान के बाद <b>भुगतान जांचें</b> दबाएँ।",
 "check_pay":"भुगतान जांचें","check_msg":"जांच हो रही है...","checking":"<b>भुगतान जांच</b>\n{bar} {pct}%",
 "crypto_title":"<b>क्रिप्टो</b>","crypto_total":"कुल: {amount}","crypto_pick":"<i>एसेट चुनें:</i>",
 "crypto_send":"यहाँ भेजें:\n<code>{address}</code>\n\nनेटवर्क: BNB Smart Chain (BEP-20)\n\n<i>इस चैट में अपना TX Hash भेजें।</i>",
 "tx_short":"<i>TX Hash बहुत छोटा है (न्यूनतम 10 अक्षर)</i>",
 "tx_ok":"<b>TX Hash प्राप्त हुआ</b>\nजारी रखने के लिए ऊपर <b>भुगतान जांचें</b> दबाएँ।",
 "tx_first":"पहले TX Hash दर्ज करें",
 "stock_title":"<b>स्टॉक खत्म</b>",
 "stock_msg":"क्षमा करें, <b>{product}</b> अभी खत्म हो गया।\n\nआपका <b>{amount}</b> <b>बैलेंस</b> में जोड़ दिया गया।\nरिफंड और निकासी के लिए बैलेंस पेज देखें।\n\n<i>निकासी के लिए न्यूनतम {min} की खरीदारी चाहिए।</i>",
 "order_title":"<b>ऑर्डर बन गया</b>",
 "order_msg":"ID: <code>{id}</code>\nउत्पाद: {product} · {price}\nस्थिति: <b>प्रोसेस हो रही है</b>\n\n<i>पुष्टि के बाद एक्सेस विवरण ईमेल पर भेजा जाएगा।</i>",
 "saldo_title":"<b>बैलेंस</b>","saldo_avail":"उपलब्ध बैलेंस: <b>{amount}</b>",
 "saldo_spent":"कुल खरीदारी: <b>{amount}</b>","saldo_streak":"चेक-इन स्ट्रीक: <b>{n} दिन</b>",
 "saldo_min":"न्यूनतम निकासी: {amount}","saldo_can":"निकासी स्थिति: ✅ संभव","saldo_need":"निकासी स्थिति: {amount} और चाहिए",
 "checkin_btn":"चेक-इन","checkin_done":"आज चेक-इन हो चुका है!",
 "checkin_ok":"+{amount}! स्ट्रीक: {n} दिन","checkin_bonus":"+{amount}! दिन {n} बोनस 🎉",
 "checkin_msg":"<i>चेक-इन सफल! +{amount}</i>",
 "website_about":"<i>प्रीमियम डिजिटल उत्पाद मार्केटप्लेस।\nAI असिस्टेंट, सॉफ्टवेयर, टूल्स।</i>",
 "help_title":"<b>सहायता</b>",
 "help_steps":"1. फ्लैश सेल / कैटलॉग से उत्पाद चुनें\n2. पैकेज और भुगतान विधि चुनें (QRIS / Crypto)\n3. भुगतान करें और भुगतान जांचें दबाएँ\n4. एक्सेस विवरण ईमेल पर भेजा जाता है",
 "help_refund":"<b>रिफंड:</b> स्टॉक खत्म होने पर स्वतः","help_withdraw":"<b>निकासी:</b> न्यूनतम {min} खरीदारी",
 "help_checkin":"<b>चेक-इन:</b> {reward}/दिन बैलेंस मेनू में",
 "help_contact":"<b>संपर्क:</b>\nWA: 087797127865\nEmail: support@upbit.my.id",
 "use_menu":"नेविगेशन के लिए नीचे मेनू का उपयोग करें।","open_web":"वेबसाइट खोलें","stock_out_tag":"स्टॉक खत्म",
 "flash_footer":"{items} उत्पाद · {groups} समूह · पेज {cur}/{total}",
 "pick_lang":"<i>भाषा चुनें:</i>",
},
"de": {
 "welcome":"<b>EVOLUSIAI</b>\nMarktplatz für digitale Produkte\n\n<i>Sprache wählen:</i>",
 "lang_set":"Sprache gespeichert: {lang}","menu_hint":"Wähle unten ein Menü:","main_menu":"<b>Hauptmenü</b>",
 "back":"« Zurück","next_page":"Mehr anzeigen →","prev_page":"« Zurück",
 "flash_loading":"<i>Flash Sale wird geladen...</i>","flash_fail":"Produkte konnten nicht geladen werden. Versuche es später erneut.",
 "catalog_loading":"<i>Katalog wird geladen...</i>","catalog_fail":"Laden fehlgeschlagen. Erneut versuchen.",
 "catalog_total":"Insgesamt: {n} Produkte","catalog_pick":"<i>Kategorie wählen:</i>","pick_item":"Wählen:","not_found":"Nicht gefunden",
 "pick_duration":"<b>Laufzeit wählen:</b>","price":"Preis: {price}","pay_method":"<i>Zahlungsmethode:</i>",
 "pkg_info":"Paket: {label} · {price}",
 "qris_title":"<b>QRIS · {amount}</b>",
 "qris_scan":"Scanne den QR-Code oben zum Bezahlen.\nNach der Überweisung auf <b>Zahlung prüfen</b> tippen.",
 "check_pay":"Zahlung prüfen","check_msg":"Prüfe...","checking":"<b>Zahlung wird geprüft</b>\n{bar} {pct}%",
 "crypto_title":"<b>Krypto</b>","crypto_total":"Gesamt: {amount}","crypto_pick":"<i>Asset wählen:</i>",
 "crypto_send":"Sende an:\n<code>{address}</code>\n\nNetzwerk: BNB Smart Chain (BEP-20)\n\n<i>Antworte mit deiner TX Hash.</i>",
 "tx_short":"<i>TX Hash zu kurz (min. 10 Zeichen)</i>",
 "tx_ok":"<b>TX Hash erhalten</b>\nTippe oben auf <b>Zahlung prüfen</b>, um fortzufahren.",
 "tx_first":"Gib zuerst die TX Hash ein",
 "stock_title":"<b>Ausverkauft</b>",
 "stock_msg":"Leider ist <b>{product}</b> gerade ausverkauft.\n\nDeine <b>{amount}</b> wurden deinem <b>Guthaben</b> gutgeschrieben.\nSiehe Guthabenseite für Erstattung & Auszahlung.\n\n<i>Mind. {min} Einkäufe für Auszahlung.</i>",
 "order_title":"<b>Bestellung erstellt</b>",
 "order_msg":"ID: <code>{id}</code>\nProdukt: {product} · {price}\nStatus: <b>In Bearbeitung</b>\n\n<i>Zugangsdetails werden nach Bestätigung per E-Mail gesendet.</i>",
 "saldo_title":"<b>GUTHABEN</b>","saldo_avail":"Verfügbares Guthaben: <b>{amount}</b>",
 "saldo_spent":"Gesamtkäufe: <b>{amount}</b>","saldo_streak":"Check-in-Serie: <b>{n} Tage</b>",
 "saldo_min":"Min. Auszahlung: {amount}","saldo_can":"Auszahlung: ✅ Möglich","saldo_need":"Auszahlung: Noch {amount} nötig",
 "checkin_btn":"Check-in","checkin_done":"Heute schon eingecheckt!",
 "checkin_ok":"+{amount}! Serie: {n} Tage","checkin_bonus":"+{amount}! Tag-{n}-Bonus 🎉",
 "checkin_msg":"<i>Check-in erfolgreich! +{amount}</i>",
 "website_about":"<i>Premium-Marktplatz für digitale Produkte.\nKI-Assistenten, Software, Tools.</i>",
 "help_title":"<b>HILFE</b>",
 "help_steps":"1. Produkt im Flash Sale / Katalog wählen\n2. Paket & Zahlungsmethode wählen (QRIS / Crypto)\n3. Bezahlen & Zahlung prüfen\n4. Zugang per E-Mail",
 "help_refund":"<b>Erstattung:</b> automatisch bei Ausverkauf","help_withdraw":"<b>Auszahlung:</b> mind. {min} Käufe",
 "help_checkin":"<b>Check-in:</b> {reward}/Tag im Guthaben-Menü",
 "help_contact":"<b>Kontakt:</b>\nWA: 087797127865\nEmail: support@upbit.my.id",
 "use_menu":"Nutze das Menü unten zur Navigation.","open_web":"Website öffnen","stock_out_tag":"Ausverkauft",
 "flash_footer":"{items} Produkte · {groups} Gruppen · Seite {cur}/{total}",
 "pick_lang":"<i>Sprache wählen:</i>",
},
"vi": {
 "welcome":"<b>EVOLUSIAI</b>\nChợ sản phẩm số\n\n<i>Chọn ngôn ngữ:</i>",
 "lang_set":"Đã lưu ngôn ngữ: {lang}","menu_hint":"Chọn menu bên dưới:","main_menu":"<b>Menu chính</b>",
 "back":"« Quay lại","next_page":"Xem thêm →","prev_page":"« Trước",
 "flash_loading":"<i>Đang tải Flash Sale...</i>","flash_fail":"Không tải được sản phẩm. Vui lòng thử lại sau.",
 "catalog_loading":"<i>Đang tải danh mục...</i>","catalog_fail":"Tải thất bại. Thử lại.",
 "catalog_total":"Tổng: {n} sản phẩm","catalog_pick":"<i>Chọn danh mục:</i>","pick_item":"Chọn:","not_found":"Không tìm thấy",
 "pick_duration":"<b>Chọn thời hạn:</b>","price":"Giá: {price}","pay_method":"<i>Phương thức thanh toán:</i>",
 "pkg_info":"Gói: {label} · {price}",
 "qris_title":"<b>QRIS · {amount}</b>",
 "qris_scan":"Quét mã QR phía trên để thanh toán.\nSau khi chuyển, nhấn <b>Kiểm tra thanh toán</b>.",
 "check_pay":"Kiểm tra thanh toán","check_msg":"Đang kiểm tra...","checking":"<b>Đang kiểm tra thanh toán</b>\n{bar} {pct}%",
 "crypto_title":"<b>TIỀN MÃ HÓA</b>","crypto_total":"Tổng: {amount}","crypto_pick":"<i>Chọn tài sản:</i>",
 "crypto_send":"Gửi đến:\n<code>{address}</code>\n\nMạng: BNB Smart Chain (BEP-20)\n\n<i>Trả lời tin này bằng TX Hash của bạn.</i>",
 "tx_short":"<i>TX Hash quá ngắn (tối thiểu 10 ký tự)</i>",
 "tx_ok":"<b>Đã nhận TX Hash</b>\nNhấn <b>Kiểm tra thanh toán</b> phía trên để tiếp tục.",
 "tx_first":"Vui lòng nhập TX Hash trước",
 "stock_title":"<b>Hết hàng</b>",
 "stock_msg":"Rất tiếc, <b>{product}</b> vừa hết hàng.\n\n<b>{amount}</b> của bạn đã vào <b>Số dư</b>.\nXem trang Số dư để hoàn tiền và rút tiền.\n\n<i>Tối thiểu {min} giao dịch để rút tiền.</i>",
 "order_title":"<b>Đơn hàng đã tạo</b>",
 "order_msg":"ID: <code>{id}</code>\nSản phẩm: {product} · {price}\nTrạng thái: <b>Đang xử lý</b>\n\n<i>Chi tiết truy cập sẽ được gửi qua email sau khi xác nhận.</i>",
 "saldo_title":"<b>SỐ DƯ</b>","saldo_avail":"Số dư khả dụng: <b>{amount}</b>",
 "saldo_spent":"Tổng giao dịch: <b>{amount}</b>","saldo_streak":"Check-in liên tiếp: <b>{n} ngày</b>",
 "saldo_min":"Rút tối thiểu: {amount}","saldo_can":"Trạng thái rút: ✅ Được","saldo_need":"Trạng thái rút: Cần thêm {amount}",
 "checkin_btn":"Check-in","checkin_done":"Hôm nay đã check-in rồi!",
 "checkin_ok":"+{amount}! Chuỗi: {n} ngày","checkin_bonus":"+{amount}! Thưởng ngày {n} 🎉",
 "checkin_msg":"<i>Check-in thành công! +{amount}</i>",
 "website_about":"<i>Chợ sản phẩm số cao cấp.\nTrợ lý AI, phần mềm, công cụ.</i>",
 "help_title":"<b>TRỢ GIÚP</b>",
 "help_steps":"1. Chọn sản phẩm từ Flash Sale / Danh mục\n2. Chọn gói & phương thức thanh toán (QRIS / Crypto)\n3. Thanh toán & nhấn Kiểm tra thanh toán\n4. Quyền truy cập gửi qua email",
 "help_refund":"<b>Hoàn tiền:</b> tự động nếu hết hàng","help_withdraw":"<b>Rút tiền:</b> tối thiểu {min} giao dịch",
 "help_checkin":"<b>Check-in:</b> {reward}/ngày trong menu Số dư",
 "help_contact":"<b>Liên hệ:</b>\nWA: 087797127865\nEmail: support@upbit.my.id",
 "use_menu":"Sử dụng menu bên dưới để điều hướng.","open_web":"Mở website","stock_out_tag":"Hết hàng",
 "flash_footer":"{items} sản phẩm · {groups} nhóm · Trang {cur}/{total}",
 "pick_lang":"<i>Chọn ngôn ngữ:</i>",
},
}

MENU = {
 "id": {"flash":"Flash Sale","catalog":"Katalog","saldo":"Saldo","website":"Website","help":"Bantuan","lang_btn":"🌐 Bahasa","store":"Toko","account":"Akun","home":"Beranda"},
 "en": {"flash":"Flash Sale","catalog":"Catalog","saldo":"Balance","website":"Website","help":"Help","lang_btn":"🌐 Language","store":"Store","account":"Account","home":"Home"},
 "zh": {"flash":"闪购","catalog":"目录","saldo":"余额","website":"网站","help":"帮助","lang_btn":"🌐 语言","store":"商店","account":"账户","home":"首页"},
 "ja": {"flash":"フラッシュセール","catalog":"カタログ","saldo":"残高","website":"ウェブサイト","help":"ヘルプ","lang_btn":"🌐 言語","store":"ストア","account":"アカウント","home":"ホーム"},
 "ru": {"flash":"Flash Sale","catalog":"Каталог","saldo":"Баланс","website":"Сайт","help":"Помощь","lang_btn":"🌐 Язык","store":"Магазин","account":"Аккаунт","home":"Главная"},
 "ms": {"flash":"Flash Sale","catalog":"Katalog","saldo":"Saldo","website":"Website","help":"Bantuan","lang_btn":"🌐 Bahasa","store":"Kedai","account":"Akaun","home":"Laman"},
 "hi": {"flash":"फ्लैश सेल","catalog":"कैटलॉग","saldo":"बैलेंस","website":"वेबसाइट","help":"सहायता","lang_btn":"🌐 भाषा","store":"स्टोर","account":"खाता","home":"होम"},
 "de": {"flash":"Flash Sale","catalog":"Katalog","saldo":"Guthaben","website":"Website","help":"Hilfe","lang_btn":"🌐 Sprache","store":"Shop","account":"Konto","home":"Start"},
 "vi": {"flash":"Flash Sale","catalog":"Danh mục","saldo":"Số dư","website":"Website","help":"Trợ giúp","lang_btn":"🌐 Ngôn ngữ","store":"Cửa hàng","account":"Tài khoản","home":"Trang chủ"},
}
# Kumpulan label untuk matching handler (semua bahasa)
_FLASH_LABELS   = {m["flash"] for m in MENU.values()}
_CATALOG_LABELS = {m["catalog"] for m in MENU.values()}
_SALDO_LABELS   = {m["saldo"] for m in MENU.values()}
_WEBSITE_LABELS = {m["website"] for m in MENU.values()}
_HELP_LABELS    = {m["help"] for m in MENU.values()}
_LANG_LABELS    = {m["lang_btn"] for m in MENU.values()}

def tr(uid, key, **kw):
    """Terjemahan sesuai bahasa user; fallback ke Indonesia."""
    lang = get_st(uid).get("lang", "id")
    tpl = I18N.get(lang, {}).get(key) or I18N["id"].get(key) or key
    try:
        return tpl.format(**kw)
    except Exception:
        return tpl

# ═══ DATA LAYER (persisten + atomic) ═══
state_lock = Lock()
bal_lock = Lock()

def _migrate_legacy():
    """Pindahkan data dari /tmp (tmpfs — hilang saat reboot) ke bot/data."""
    if not os.path.exists(STATE_FILE) and os.path.exists(LEGACY_STATE_FILE):
        try:
            import shutil; shutil.copy(LEGACY_STATE_FILE, STATE_FILE)
            log.info("Migrasi state dari /tmp selesai")
        except Exception as e:
            log.warning(f"Migrasi state gagal: {e}")
    if not os.path.exists(BAL_FILE) and os.path.exists(LEGACY_BAL_FILE):
        try:
            import shutil; shutil.copy(LEGACY_BAL_FILE, BAL_FILE)
            log.info("Migrasi balance dari /tmp selesai")
        except Exception as e:
            log.warning(f"Migrasi balance gagal: {e}")

def _read_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def _write_json(path, data):
    """Tulis atomic (temp + rename) supaya tidak korup saat crash."""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)

def load_s():
    return _read_json(STATE_FILE, {})

def get_st(uid):
    return load_s().get(str(uid), {"lang": "id"})

def update_st(uid, fn):
    """Read-modify-write atomik untuk state user."""
    with state_lock:
        s = load_s()
        st = s.get(str(uid), {"lang": "id"})
        s[str(uid)] = fn(dict(st))
        _write_json(STATE_FILE, s)
        return s[str(uid)]

def set_st(uid, d):
    return update_st(uid, lambda _: d)

def default_bal():
    return {"balance": 0, "streak": 0, "lastCheckIn": None, "totalSpent": 0, "purchased": []}

def load_bal():
    return _read_json(BAL_FILE, {})

def get_bal(uid):
    b = load_bal()
    d = b.get(str(uid), default_bal())
    d.setdefault("purchased", [])
    return d

def update_bal(uid, fn):
    """Read-modify-write atomik untuk saldo user.
    Kalau fn mengembalikan tuple (dict, extra) → yang disimpan ke file HANYA dict-nya.
    (mencegah tuple ikut terserialisasi jadi list yang mengkorup data saldo)"""
    with bal_lock:
        b = load_bal()
        d = b.get(str(uid), default_bal())
        d.setdefault("purchased", [])
        res = fn(d)
        if isinstance(res, tuple) and len(res) == 2 and isinstance(res[0], dict):
            b[str(uid)] = res[0]
            _write_json(BAL_FILE, b)
            return res
        b[str(uid)] = res
        _write_json(BAL_FILE, b)
        return res

def mark_purchased(uid, product_id):
    def _fn(b):
        if product_id and product_id not in b["purchased"]:
            b["purchased"].append(product_id)
        return b
    return update_bal(uid, _fn)

# ═══ API ═══
def g(path, tries=2):
    for i in range(tries):
        try:
            r = requests.get(f"{API_BASE}{path}", timeout=10)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        if i == 0:
            time.sleep(1)
    return None

PCACHE = {"d": None, "t": 0}
def prods():
    n = time.time()
    if PCACHE["d"] and (n - PCACHE["t"]) < 300:
        return PCACHE["d"]
    d = g("/products")
    if d:
        PCACHE["d"] = d
        PCACHE["t"] = n
    elif PCACHE["d"]:
        # API gagal → pakai cache lama (lebih baik daripada kosong)
        PCACHE["t"] = n - 240
    return d or PCACHE["d"]

# ═══ MATA UANG per BAHASA ═══
# Balance disimpan dalam IDR. Display dikonversi sesuai bahasa user.
USD_RATE = 16300  # 1 USD = Rp 16.300
CURRENCY = {
    "id": {"symbol": "Rp",   "rate": 1,             "dec": 0},
    "ms": {"symbol": "Rp",   "rate": 1,             "dec": 0},
    "en": {"symbol": "$",    "rate": USD_RATE,       "dec": 2},
    "zh": {"symbol": "¥",    "rate": USD_RATE / 7.2, "dec": 2},
    "ja": {"symbol": "¥",    "rate": USD_RATE / 150, "dec": 0},
    "ru": {"symbol": "₽",    "rate": USD_RATE / 95,  "dec": 2},
    "hi": {"symbol": "₹",    "rate": USD_RATE / 83.5,"dec": 2},
    "de": {"symbol": "€",    "rate": USD_RATE / 0.92,"dec": 2},
    "vi": {"symbol": "₫",    "rate": USD_RATE / 25450,"dec": 0},
}

def fp(n, uid=None):
    """Format harga/saldo sesuai bahasa user. Tanpa uid → IDR."""
    lang = get_st(uid).get("lang", "id") if uid else "id"
    c = CURRENCY.get(lang, CURRENCY["id"])
    val = (n or 0) / c["rate"]
    sym = c["symbol"]
    if c["dec"] == 0:
        s = f"{val:,.0f}"
    else:
        s = f"{val:,.{c["dec"]}f}"
    # Bersihkan trailing zeros (tapi pertahankan desimal untuk USD/EUR/dll)
    if c["dec"] > 0:
        s = s.rstrip("0").rstrip(".") if "." in s else s
    return f"{sym} {s}"

def is_stock_out_price(price):
    """Sama dengan aturan server: 30.000–80.000 IDR selalu auto-refund."""
    return STOCK_OUT_MIN <= int(price or 0) <= STOCK_OUT_MAX

# ═══ QR ═══
def gen_qr(data):
    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

# ═══ HELPERS ═══
def esc(s):
    """Escape karakter HTML untuk parse_mode=HTML."""
    if s is None:
        return ""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def get_period_label(p):
    """Label durasi dari produk (period field / turunan dari ID)."""
    period = (p.get('period') or '').strip()
    if period and period not in ('bln', 'paket'):
        return period
    pid = p.get('id', '')
    if '-multi' in pid:
        return '3 Bulan'
    if '-4bln' in pid:
        return '4 Bulan'
    if '-6bln' in pid:
        return '6 Bulan'
    if '-1thn' in pid:
        return '1 Tahun'
    if '-12' in pid:
        return '12 Bulan'
    if '-18' in pid:
        return '18 Bulan'
    return '1 Bulan'

def get_promo_groups():
    """Produk Flash Sale di-group per nama (urutan stabil)."""
    from collections import OrderedDict
    p = prods()
    if not p:
        return None
    groups = OrderedDict()
    for x in p:
        if x.get("category") != "Promo":
            continue
        name = x['name']
        groups.setdefault(name, []).append(x)
    return groups or None

def lang_of(uid):
    return get_st(uid).get("lang", "id")

# ═══ KEYBOARDS ═══
def lang_kb():
    kb = types.InlineKeyboardMarkup(row_width=3)
    btns = [types.InlineKeyboardButton(f"{v}", callback_data=f"lang|{k}") for k, v in LANGS.items()]
    for i in range(0, len(btns), 3):
        kb.add(*btns[i:i + 3])
    return kb

def main_kb(lang="id"):
    m = MENU.get(lang, MENU["id"])
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    kb.add(m["flash"], m["catalog"])
    kb.add(m["saldo"], m["website"])
    kb.add(m["help"])
    kb.add(m["lang_btn"])
    return kb

# ═══ HANDLERS ═══

@bot.message_handler(commands=["start"])
def start(m):
    uid = str(m.chat.id)
    if is_banned(uid):
        return
    update_st(uid, lambda _: {"lang": "id"})
    bot.send_message(m.chat.id, tr(uid, "welcome"), reply_markup=lang_kb())

@bot.callback_query_handler(func=lambda c: c.data.startswith("lang|"))
def on_lang(call):
    lang = call.data.split("|")[1]
    uid = str(call.message.chat.id)
    update_st(uid, lambda _: {"lang": lang})
    bot.delete_message(call.message.chat.id, call.message.message_id)
    bot.send_message(call.message.chat.id,
        f"<b>EVOLUSIAI</b>\n{tr(uid, 'lang_set', lang=LANGS.get(lang, lang))}\n\n{tr(uid, 'menu_hint')}",
        reply_markup=main_kb(lang))

@bot.callback_query_handler(func=lambda c: c.data == "back_menu")
def back(call):
    uid = str(call.message.chat.id)
    bot.delete_message(call.message.chat.id, call.message.message_id)
    bot.send_message(call.message.chat.id, tr(uid, "main_menu"), reply_markup=main_kb(lang_of(uid)))

@bot.message_handler(func=lambda m: m.text in _LANG_LABELS)
def change_lang(m):
    uid = str(m.chat.id)
    bot.send_message(m.chat.id, tr(uid, "pick_lang"), reply_markup=lang_kb())

# ═══ FLASH SALE PAGINATION ═══
FLASH_PAGE_SIZE = 8

def build_flash_keyboard(groups, page, total_pages, uid):
    page = max(0, min(page, total_pages - 1))
    start = page * FLASH_PAGE_SIZE
    group_list = list(groups.items())
    page_items = group_list[start:start + FLASH_PAGE_SIZE]
    purchased = get_bal(uid)["purchased"]

    kb = types.InlineKeyboardMarkup(row_width=1)
    for name, items in page_items:
        prices = sorted(set(it['price'] for it in items))
        if len(prices) == 1:
            label = f"{name} · {fp(prices[0], uid)}"
        else:
            label = f"{name} · {fp(min(prices), uid)} – {fp(max(prices), uid)}  ({len(items)} paket)"
        if all(it['id'] in purchased for it in items):
            label += " ❌"
        kb.add(types.InlineKeyboardButton(label, callback_data=f"selgrp|{name}"))

    nav_row = []
    if page > 0:
        nav_row.append(types.InlineKeyboardButton(tr(uid, "prev_page"), callback_data=f"flashpage|{page - 1}"))
    if page < total_pages - 1:
        nav_row.append(types.InlineKeyboardButton(tr(uid, "next_page"), callback_data=f"flashpage|{page + 1}"))
    if nav_row:
        kb.row(*nav_row)
    kb.add(types.InlineKeyboardButton(tr(uid, "back"), callback_data="back_menu"))
    return kb

def build_flash_text(groups, page, total_pages, uid):
    page = max(0, min(page, total_pages - 1))
    start = page * FLASH_PAGE_SIZE
    group_list = list(groups.items())
    page_items = group_list[start:start + FLASH_PAGE_SIZE]
    purchased = get_bal(uid)["purchased"]

    lines = []
    for name, items in page_items:
        prices = sorted(set(it['price'] for it in items))
        sold = all(it['id'] in purchased for it in items)
        if len(prices) == 1:
            line = f"<b>{esc(name)}</b> · {fp(prices[0], uid)}"
        else:
            line = f"<b>{esc(name)}</b> · {fp(min(prices), uid)} – {fp(max(prices), uid)}"
        if sold:
            line += " ❌"
        lines.append(line)

    t = "\n".join(lines)
    total_items = sum(len(items) for _, items in groups.items())
    footer = tr(uid, "flash_footer", items=total_items, groups=len(groups), cur=page + 1, total=total_pages)
    return (f"<b>🔥 FLASH SALE</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n{t}\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"<i>{footer}</i>")

# ── FLASH SALE ──
@bot.message_handler(func=lambda m: m.text in _FLASH_LABELS)
def flash(m):
    uid = str(m.chat.id)
    l = bot.send_message(m.chat.id, tr(uid, "flash_loading"))
    groups = get_promo_groups()
    if not groups:
        bot.edit_message_text(tr(uid, "flash_fail"), m.chat.id, l.message_id)
        return
    total_pages = (len(groups) + FLASH_PAGE_SIZE - 1) // FLASH_PAGE_SIZE
    kb = build_flash_keyboard(groups, 0, total_pages, uid)
    text = build_flash_text(groups, 0, total_pages, uid)
    bot.edit_message_text(text, m.chat.id, l.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("flashpage|"))
def on_flashpage(call):
    try:
        page = int(call.data.split("|")[1])
    except Exception:
        page = 0
    uid = str(call.message.chat.id)
    groups = get_promo_groups()
    if not groups:
        bot.answer_callback_query(call.id, tr(uid, "flash_fail"))
        return
    total_pages = (len(groups) + FLASH_PAGE_SIZE - 1) // FLASH_PAGE_SIZE
    kb = build_flash_keyboard(groups, page, total_pages, uid)
    text = build_flash_text(groups, page, total_pages, uid)
    try:
        bot.edit_message_text(text, call.message.chat.id, call.message.message_id, reply_markup=kb)
    except Exception:
        bot.answer_callback_query(call.id, tr(uid, "not_found"))

# ── KATALOG ──
@bot.message_handler(func=lambda m: m.text in _CATALOG_LABELS)
def catalog(m):
    uid = str(m.chat.id)
    l = bot.send_message(m.chat.id, tr(uid, "catalog_loading"))
    p = prods()
    if not p:
        bot.edit_message_text(tr(uid, "catalog_fail"), m.chat.id, l.message_id)
        return
    cats = {}
    for x in p:
        cats.setdefault(x.get("category", "Lainnya"), []).append(x)
    kb = types.InlineKeyboardMarkup(row_width=1)
    for c, pl in list(cats.items())[:8]:
        kb.add(types.InlineKeyboardButton(f"{c} ({len(pl)})", callback_data=f"cat|{c}"))
    kb.add(types.InlineKeyboardButton(tr(uid, "back"), callback_data="back_menu"))
    bot.edit_message_text(
        f"<b>KATALOG</b>\n{'━' * 20}\n{tr(uid, 'catalog_total', n=len(p))}\n{tr(uid, 'catalog_pick')}",
        m.chat.id, l.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("cat|"))
def on_cat(call):
    cat = call.data.split("|")[1]
    uid = str(call.message.chat.id)
    p = prods()
    pl = [x for x in (p or []) if x.get("category") == cat]
    kb = types.InlineKeyboardMarkup(row_width=1)
    for x in pl[:10]:
        kb.add(types.InlineKeyboardButton(f"{x['name']} · {fp(x['price'], uid)}", callback_data=f"sel|{x['id']}"))
    kb.add(types.InlineKeyboardButton(tr(uid, "back"), callback_data="back_menu"))
    bot.edit_message_text(
        f"<b>{esc(cat)}</b>\n{'━' * 20}\n{tr(uid, 'catalog_total', n=len(pl))}\n<i>{tr(uid, 'pick_item')}</i>",
        call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── FLASH SALE GROUP → VARIAN DURASI ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("selgrp|"))
def on_selgrp(call):
    name = call.data.split("|")[1]
    uid = str(call.message.chat.id)
    p = prods()
    variants = [x for x in (p or []) if x.get("name") == name and x.get("category") == "Promo"]
    variants.sort(key=lambda x: x['price'])

    if not variants:
        bot.answer_callback_query(call.id, tr(uid, "not_found"))
        return

    purchased = get_bal(uid)["purchased"]
    update_st(uid, lambda st: {**st, "pname": name})

    kb = types.InlineKeyboardMarkup(row_width=1)
    for v in variants:
        period = get_period_label(v)
        label = f"{period} · {fp(v['price'], uid)}"
        if v.get('discountPercent'):
            label += f"  (-{v['discountPercent']}%)"
        if v['id'] in purchased:
            label += " ❌ " + tr(uid, "stock_out_tag")
        kb.add(types.InlineKeyboardButton(label, callback_data=f"tier|{v['id']}|{period}|{v['price']}"))
    kb.add(types.InlineKeyboardButton(tr(uid, "back"), callback_data="back_menu"))

    tagline = variants[0].get('tagline', '')
    prices = sorted(set(v['price'] for v in variants))
    price_text = fp(prices[0], uid) if len(prices) == 1 else f"{fp(min(prices), uid)} – {fp(max(prices), uid)}"

    bot.edit_message_text(
        f"<b>{esc(name)}</b>\n"
        f"<i>{esc(tagline)}</i>\n{'━' * 20}\n"
        f"{tr(uid, 'price', price=price_text)}\n"
        f"{tr(uid, 'pick_duration')}",
        call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── PRODUCT (KATALOG) → TIER ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("sel|"))
def on_sel(call):
    pid = call.data.split("|")[1]
    uid = str(call.message.chat.id)
    p = prods()
    prod = next((x for x in (p or []) if x["id"] == pid), None)
    if not prod:
        bot.answer_callback_query(call.id, tr(uid, "not_found"))
        return

    name = prod['name']
    variants = [x for x in (p or []) if x.get("name") == name and x.get("category") == "Promo"]

    if len(variants) > 1:
        variants.sort(key=lambda x: x['price'])
        purchased = get_bal(uid)["purchased"]
        update_st(uid, lambda st: {**st, "pname": name})
        kb = types.InlineKeyboardMarkup(row_width=1)
        for v in variants:
            period = get_period_label(v)
            label = f"{period} · {fp(v['price'], uid)}"
            if v['id'] in purchased:
                label += " ❌ " + tr(uid, "stock_out_tag")
            kb.add(types.InlineKeyboardButton(label, callback_data=f"tier|{v['id']}|{period}|{v['price']}"))
        kb.add(types.InlineKeyboardButton(tr(uid, "back"), callback_data="back_menu"))
        prices = sorted(set(v['price'] for v in variants))
        price_text = fp(prices[0], uid) if len(prices) == 1 else f"{fp(min(prices), uid)} – {fp(max(prices), uid)}"
        bot.edit_message_text(
            f"<b>{esc(name)}</b>\n"
            f"<i>{esc(prod.get('tagline', ''))}</i>\n{'━' * 20}\n"
            f"{tr(uid, 'price', price=price_text)}\n"
            f"{tr(uid, 'pick_duration')}",
            call.message.chat.id, call.message.message_id, reply_markup=kb)
        return

    # Single product: langsung ke payment
    update_st(uid, lambda st: {**st, "pid": pid, "pname": name, "tier_label": "Standard", "tier_price": prod["price"]})

    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton(f"QRIS · {fp(prod['price'], uid)}", callback_data=f"pay|qris|{prod['price']}"),
        types.InlineKeyboardButton("Crypto", callback_data=f"pay|crypto|{prod['price']}"))
    kb.add(types.InlineKeyboardButton(tr(uid, "back"), callback_data="back_menu"))
    bot.edit_message_text(
        f"<b>{esc(prod['name'])}</b>\n"
        f"<i>{esc(prod.get('tagline', ''))}</i>\n{'━' * 20}\n"
        f"{tr(uid, 'price', price=fp(prod['price'], uid))}\n"
        f"{tr(uid, 'pay_method')}",
        call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── TIER → PAYMENT ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("tier|"))
def on_tier(call):
    parts = call.data.split("|", 3)
    if len(parts) < 4:
        bot.answer_callback_query(call.id, "Error")
        return
    _, pid, label, price_s = parts
    try:
        price = int(price_s)
    except Exception:
        price = 0
    uid = str(call.message.chat.id)
    # Simpan pid (bug lama: pid tidak tersimpan di flow Flash Sale → "unknown")
    st = update_st(uid, lambda s: {**s, "pid": pid, "tier_label": label, "tier_price": price})
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton(f"QRIS · {fp(price, uid)}", callback_data=f"pay|qris|{price}"),
        types.InlineKeyboardButton("Crypto", callback_data=f"pay|crypto|{price}"))
    kb.add(types.InlineKeyboardButton(tr(uid, "back"), callback_data="back_menu"))
    bot.edit_message_text(
        f"<b>{esc(st.get('pname', ''))}</b>\n"
        f"{tr(uid, 'pkg_info', label=esc(label), price=fp(price))}\n{'━' * 20}\n"
        f"{tr(uid, 'pay_method')}",
        call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── PAYMENT: QRIS / CRYPTO ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("pay|"))
def on_pay(call):
    parts = call.data.split("|", 2)
    if len(parts) < 3:
        bot.answer_callback_query(call.id, "Error")
        return
    _, method, amt_s = parts
    try:
        amt = int(amt_s)
    except Exception:
        amt = 0
    uid = str(call.message.chat.id)
    update_st(uid, lambda st: {**st, "pay_method": method, "amount": amt})

    if method == "qris":
        qr = gen_qr(build_qris(amt))
        kb = types.InlineKeyboardMarkup()
        kb.add(types.InlineKeyboardButton(tr(uid, "check_pay"), callback_data=f"check|{amt}"))
        kb.add(types.InlineKeyboardButton(tr(uid, "back"), callback_data="back_menu"))
        bot.delete_message(call.message.chat.id, call.message.message_id)
        bot.send_photo(call.message.chat.id, qr,
            caption=f"{tr(uid, 'qris_title', amount=fp(amt, uid))}\n"
                    f"{'━' * 20}\n"
                    f"{tr(uid, 'qris_scan')}",
            reply_markup=kb)
    else:
        kb = types.InlineKeyboardMarkup(row_width=1)
        for a in CRYPTO:
            ca = round(amt / a["rate"], a["dec"])
            kb.add(types.InlineKeyboardButton(f"{a['symbol']} · {ca}", callback_data=f"crypto|{a['id']}|{amt}"))
        kb.add(types.InlineKeyboardButton(tr(uid, "back"), callback_data="back_menu"))
        bot.edit_message_text(
            f"{tr(uid, 'crypto_title')}\n{'━' * 20}\n"
            f"{tr(uid, 'crypto_total', amount=fp(amt))}\n{tr(uid, 'crypto_pick')}",
            call.message.chat.id, call.message.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("crypto|"))
def on_crypto(call):
    parts = call.data.split("|", 2)
    if len(parts) < 3:
        bot.answer_callback_query(call.id, "Error")
        return
    _, aid, amt_s = parts
    try:
        amt = int(amt_s)
    except Exception:
        amt = 0
    uid = str(call.message.chat.id)
    a = next((x for x in CRYPTO if x["id"] == aid), None)
    if not a:
        bot.answer_callback_query(call.id, tr(uid, "not_found"))
        return
    ca = round(amt / a["rate"], a["dec"])
    update_st(uid, lambda st: {**st, "crypto_asset": aid, "crypto_amount": ca, "waiting_tx": True})
    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton(tr(uid, "check_pay"), callback_data=f"check|{amt}"))
    kb.add(types.InlineKeyboardButton(tr(uid, "back"), callback_data="back_menu"))
    bot.edit_message_text(
        f"<b>{a['symbol']} · {ca}</b>\n"
        f"{'━' * 20}\n"
        f"{tr(uid, 'crypto_send', address=a['address'])}",
        call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── CHECK PAYMENT ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("check|"))
def on_check(call):
    amt_s = call.data.split("|")[1]
    try:
        amt = int(amt_s)
    except Exception:
        amt = 0
    uid = str(call.message.chat.id)
    st = get_st(uid)
    if st.get("pay_method") == "crypto" and st.get("waiting_tx"):
        bot.answer_callback_query(call.id, tr(uid, "tx_first"))
        return
    if st.get("_checking"):
        # Cegah double-tap pada tombol Cek Pembayaran
        bot.answer_callback_query(call.id, tr(uid, "check_msg"))
        return
    update_st(uid, lambda s: {**s, "_checking": True})

    try:
        bot.answer_callback_query(call.id, tr(uid, "check_msg"))
        lm = bot.send_message(call.message.chat.id, tr(uid, "checking", bar="[" + " " * 5 + "]", pct=0))
        for i in range(1, 6):
            time.sleep(1)
            bar = "[" + "█" * i + " " * (5 - i) + "]"
            try:
                bot.edit_message_text(tr(uid, "checking", bar=bar, pct=i * 20),
                                      call.message.chat.id, lm.message_id)
            except Exception:
                pass

        price = st.get("tier_price", amt) or amt
        pid = st.get("pid", "unknown")
        pname = st.get("pname", "Produk")
        stock_out = is_stock_out_price(price)

        try:
            bot.delete_message(call.message.chat.id, lm.message_id)
        except Exception:
            pass

        # ── Simulasi lokal (bot tanpa login; data per Telegram user ID) ──
        if stock_out:
            # Refund ke saldo + tandai produk "dibeli" (stok habis per user)
            update_bal(uid, lambda b: {**b, "balance": b.get("balance", 0) + price})
            mark_purchased(uid, pid)
            bot.send_message(call.message.chat.id,
                f"{tr(uid, 'stock_title')}\n"
                f"{'━' * 20}\n"
                f"{tr(uid, 'stock_msg', product=esc(pname), amount=fp(price, uid), min=fp(MIN_WITHDRAW, uid))}",
                reply_markup=main_kb(lang_of(uid)))
        else:
            # Pesanan dibuat (lokal) — hanya order NON-stok-habis yang masuk total transaksi
            oid = "EVO-TG-" + hashlib.sha1(f"{uid}:{pid}:{time.time()}".encode()).hexdigest()[:6].upper()
            update_bal(uid, lambda b: {**b, "totalSpent": b.get("totalSpent", 0) + price})
            mark_purchased(uid, pid)
            bot.send_message(call.message.chat.id,
                f"{tr(uid, 'order_title')}\n"
                f"{'━' * 20}\n"
                f"{tr(uid, 'order_msg', id=oid, product=esc(pname), price=fp(price, uid))}",
                reply_markup=main_kb(lang_of(uid)))
    finally:
        # Reset state flow (pertahankan bahasa) — sekaligus bersihkan flag _checking
        lang = lang_of(uid)
        update_st(uid, lambda _: {"lang": lang})

# ── SALDO ──
@bot.message_handler(func=lambda m: m.text in _SALDO_LABELS)
def balance(m):
    uid = str(m.chat.id)
    bal = get_bal(uid)
    eligible = bal["totalSpent"] >= MIN_WITHDRAW
    kurang = fp(MIN_WITHDRAW - bal["totalSpent"], uid)
    text = (
        f"{tr(uid, 'saldo_title')}\n"
        f"{'━' * 20}\n"
        f"{tr(uid, 'saldo_avail', amount=fp(bal['balance'], uid))}\n"
        f"{tr(uid, 'saldo_spent', amount=fp(bal['totalSpent'], uid))}\n"
        f"{tr(uid, 'saldo_streak', n=bal['streak'])}\n"
        f"{'━' * 20}\n"
        f"{tr(uid, 'saldo_min', amount=fp(MIN_WITHDRAW, uid))}\n"
        f"{tr(uid, 'saldo_can') if eligible else tr(uid, 'saldo_need', amount=kurang)}"
    )
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton(tr(uid, "checkin_btn"), callback_data="checkin"),
        types.InlineKeyboardButton(tr(uid, "open_web"), url=f"{STORE_URL}/balance"))
    bot.send_message(m.chat.id, text, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data == "checkin")
def checkin(call):
    uid = str(call.message.chat.id)
    bal, result = update_bal(uid, _do_checkin)
    if result is None:
        bot.answer_callback_query(call.id, tr(uid, "checkin_done"))
        return
    reward, new_streak, is_bonus = result
    if is_bonus:
        msg = tr(uid, "checkin_bonus", amount=fp(reward, uid), n=new_streak)
    else:
        msg = tr(uid, "checkin_ok", amount=fp(reward, uid), n=new_streak)
    bot.answer_callback_query(call.id, msg)
    bot.edit_message_text(
        f"{tr(uid, 'saldo_title')}\n"
        f"{'━' * 20}\n"
        f"{tr(uid, 'saldo_avail', amount=fp(bal['balance'], uid))}\n"
        f"{tr(uid, 'saldo_streak', n=bal['streak'])}\n"
        f"{'━' * 20}\n"
        f"{tr(uid, 'checkin_msg', amount=fp(reward, uid))}",
        call.message.chat.id, call.message.message_id,
        reply_markup=types.InlineKeyboardMarkup().add(
            types.InlineKeyboardButton(tr(uid, "open_web"), url=f"{STORE_URL}/balance")))

def _do_checkin(b):
    """Logika check-in SINKRON dengan website: 300/hari, bonus 2000 hari ke-7,
    streak reset kalau bolos, cycle restart setelah hari ke-7.
    Return (b, None) kalau sudah check-in hari ini; (b, (reward, streak, is_bonus)) kalau sukses."""
    today = date.today().isoformat()
    if b.get("lastCheckIn") == today:
        return b, None
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    new_streak = 1
    if b.get("lastCheckIn") == yesterday:
        new_streak = (b.get("streak") or 0) + 1
    if new_streak >= CHECKIN_CYCLE:
        reward, final_streak, is_bonus = CHECKIN_BONUS, 0, True
    else:
        reward, final_streak, is_bonus = CHECKIN_REWARD, new_streak, False
    b["balance"] = b.get("balance", 0) + reward
    b["streak"] = final_streak
    b["lastCheckIn"] = today
    return b, (reward, new_streak, is_bonus)

# ── WEBSITE ──
@bot.message_handler(func=lambda m: m.text in _WEBSITE_LABELS)
def website(m):
    uid = str(m.chat.id)
    kb = types.InlineKeyboardMarkup(row_width=1)
    kb.add(types.InlineKeyboardButton(tr(uid, "open_web"), url=STORE_URL))
    kb.add(types.InlineKeyboardButton("💬 WhatsApp Admin", url="https://wa.me/6287797127865"))
    bot.send_message(m.chat.id,
        f"<b>EVOLUSIAI</b>\n"
        f"{'━' * 20}\n"
        f"{tr(uid, 'website_about')}",
        reply_markup=kb)

# ── BANTUAN ──
@bot.message_handler(func=lambda m: m.text in _HELP_LABELS)
def help_cmd(m):
    uid = str(m.chat.id)
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton(tr(uid, "open_web"), url=STORE_URL),
        types.InlineKeyboardButton("💬 WhatsApp", url="https://wa.me/6287797127865"))
    bot.send_message(m.chat.id,
        f"{tr(uid, 'help_title')}\n"
        f"{'━' * 20}\n"
        f"{tr(uid, 'help_steps')}\n\n"
        f"{tr(uid, 'help_refund')}\n"
        f"{tr(uid, 'help_withdraw', min=fp(MIN_WITHDRAW, uid))}\n"
        f"{tr(uid, 'help_checkin', reward=fp(CHECKIN_REWARD, uid))}\n\n"
        f"{'━' * 20}\n"
        f"{tr(uid, 'help_contact')}",
        reply_markup=kb)

# ── TX HASH + SPAM FILTER + FALLBACK (LAST) ──
@bot.message_handler(func=lambda m: True)
def on_text(m):
    uid = str(m.chat.id)
    username = getattr(m.from_user, 'username', None) or ''
    first_name = getattr(m.from_user, 'first_name', None) or ''
    text = (m.text or '').strip()

    # Log semua pesan untuk tracking
    log_msg(uid, username, first_name, text)

    # Cek banned user
    if is_banned(uid):
        log.info(f"Blocked banned user {uid} ({username or first_name})")
        return  # silent ignore

    # Cek spam
    is_sp, reason = is_spam(text)
    if is_sp:
        log.warning(f"SPAM from uid={uid} ({username or first_name}): reason={reason} text={text[:100]}")
        # Coba hapus pesan spam
        try:
            bot.delete_message(m.chat.id, m.message_id)
        except Exception:
            pass
        # Ban user otomatis
        ban_user(uid, f"spam: {reason}")
        try:
            bot.send_message(m.chat.id, "🚫 <b>Akun diblokir karena spam/iklan.</b>", parse_mode="HTML")
        except Exception:
            pass
        return

    # TX Hash handler
    st = get_st(uid)
    if st.get("waiting_tx"):
        tx = text
        if len(tx) < 10:
            bot.send_message(m.chat.id, tr(uid, "tx_short"))
            return
        update_st(uid, lambda s: {**s, "tx_hash": tx, "waiting_tx": False})
        bot.send_message(m.chat.id, tr(uid, "tx_ok"))
        return

    bot.send_message(m.chat.id, tr(uid, "use_menu"), reply_markup=main_kb(lang_of(uid)))

# ═══ MAIN ═══
if __name__ == "__main__":
    _migrate_legacy()

    if os.path.exists(LOCK_FILE):
        try:
            os.kill(int(open(LOCK_FILE).read().strip()), 0)
            log.error("Already running")
            sys.exit(1)
        except Exception:
            pass
    with open(LOCK_FILE, "w") as f:
        f.write(str(os.getpid()))

    log.info("=" * 50)
    log.info("EVOLUSIAI BOT v4 — starting...")
    log.info(f"API: {API_BASE} | Data: {DATA_DIR}")

    while True:
        try:
            log.info("Polling...")
            bot.infinity_polling(timeout=30, long_polling_timeout=60)
        except requests.exceptions.ReadTimeout:
            log.warning("Timeout")
            time.sleep(2)
        except Exception as e:
            log.error(f"Error: {e}")
            time.sleep(5)
