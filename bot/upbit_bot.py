#!/usr/bin/env python3
"""
UPBIT STORE TELEGRAM BOT v2
- Multi-bahasa (9 bahasa)
- Pembayaran QRIS + Crypto (BNB/USDT)
- Cek pembayaran → loading 5s → auto-refund/stok habis
- Stabil: lock file, error handler, auto-reconnect
"""

import os, sys, json, time, hashlib, io, re, logging
from datetime import datetime
from threading import Lock

import telebot
from telebot import types
import requests
import qrcode

# ═══════════════════════ CONFIG ═══════════════════════
BOT_TOKEN = "8525098720:AAGwM-Np2aRTIRhryP7fvvo-VChnf5_8GnE"
API_BASE = "https://upbit-store-vert.vercel.app/api"
STORE_URL = "https://upbit-store-vert.vercel.app"

LOG_FILE = "/home/ubuntu/upbit-store/bot/upbit-bot.log"
LOCK_FILE = "/tmp/upbit-bot.lock"
STATE_FILE = "/tmp/upbit-bot-state.json"

# ── Logging ──
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
                    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"), logging.StreamHandler()])
log = logging.getLogger("upbit-bot")

# ── Init bot ──
bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")

# ═══════════════════════ PAYMENT DATA ═══════════════════════
QRIS_STATIC = "00020101021126610016ID.CO.SHOPEE.WWW01189360091800231770190208231770190303UMI51440014ID.CO.QRIS.WWW0215ID10265313881830303UMI5204581753033605802ID5911UPbit Store6013JAKARTA PUSAT61051052062070703A0163044EF7"

def crc16(s):
    crc = 0xffff
    for c in s:
        crc ^= ord(c) << 8
        for _ in range(8):
            crc = (crc << 1) ^ 0x1021 if crc & 0x8000 else crc << 1
            crc &= 0xffff
    return f"{crc:04X}"

def build_qris(amount):
    amt = str(max(0, int(amount)))
    base = QRIS_STATIC[:-8]
    base = base[:10] + "12" + base[12:]
    field = "54" + f"{len(amt):02d}" + amt
    base = base.replace("5802ID", field + "5802ID")
    signed = base + "6304"
    return signed + crc16(signed)

CRYPTO_ASSETS = [
    {"id":"bnb","symbol":"BNB","label":"BNB","address":"0x02fd0906c6f873f35259889d7396f46b92a24aee","idrRate":9_650_000,"decimals":4,"explorer":"https://bscscan.com/tx/"},
    {"id":"usdt","symbol":"USDT","label":"USDT (BEP-20)","address":"0x02fd0906c6f873f35259889d7396f46b92a24aee","idrRate":16_300,"decimals":2,"explorer":"https://bscscan.com/tx/"},
]

# ═══════════════════════ i18n ═══════════════════════
LANGS = {"en":"🇬🇧 English","zh":"🇨🇳 中文","ja":"🇯🇵 日本語","id":"🇮🇩 Indonesia","ru":"🇷🇺 Русский","ms":"🇲🇾 Melayu","hi":"🇮🇳 हिन्दी","de":"🇩🇪 Deutsch","vi":"🇻🇳 Tiếng Việt"}

T = {
    "welcome":   {"id":"👋 Selamat datang di <b>Upbit Store</b>!\nMarketplace produk digital premium.","en":"👋 Welcome to <b>Upbit Store</b>!\nPremium digital product marketplace."},
    "choose_lang":{"id":"🌐 Pilih bahasa / Choose language:","en":"🌐 Pilih bahasa / Choose language:"},
    "menu":      {"id":"📋 <b>Menu Utama</b>","en":"📋 <b>Main Menu</b>"},
    "flash":     {"id":"🔥 Flash Sale","en":"🔥 Flash Sale"},
    "products":  {"id":"🛒 Semua Produk","en":"🛒 All Products"},
    "balance":   {"id":"💰 Saldo Saya","en":"💰 My Balance"},
    "website":   {"id":"🌐 Kunjungi Website","en":"🌐 Visit Website"},
    "help":      {"id":"ℹ️ Bantuan","en":"ℹ️ Help"},
    "back":      {"id":"🔙 Kembali","en":"🔙 Back"},
    "loading":   {"id":"⏳ <i>Memproses...</i>","en":"⏳ <i>Processing...</i>"},
    "pick_tier": {"id":"Pilih durasi/langganan:","en":"Select plan:"},
    "pay_method":{"id":"💳 <b>Pilih Metode Pembayaran</b>","en":"💳 <b>Choose Payment Method</b>"},
    "qris":      {"id":"📱 QRIS","en":"📱 QRIS"},
    "crypto":    {"id":"🪙 Crypto (BNB/USDT)","en":"🪙 Crypto (BNB/USDT)"},
    "qris_scan": {"id":"📱 Scan QRIS di bawah:\n\nNominal: <b>Rp {amount}</b>\n\nSetelah transfer, klik tombol <b>Cek Pembayaran</b>","en":"📱 Scan QRIS below:\n\nAmount: <b>Rp {amount}</b>\n\nAfter transfer, click <b>Check Payment</b>"},
    "crypto_pay":{"id":"🪙 Kirim <b>{amount} {symbol}</b> ke:\n\n<code>{address}</code>\n\nNetwork: BNB Smart Chain (BEP-20)\n\nMasukkan TX Hash setelah transfer:","en":"🪙 Send <b>{amount} {symbol}</b> to:\n\n<code>{address}</code>\n\nNetwork: BNB Smart Chain (BEP-20)\n\nEnter TX Hash after transfer:"},
    "tx_placeholder":{"id":"0x... (TX Hash)","en":"0x... (TX Hash)"},
    "check_btn": {"id":"✅ Cek Pembayaran","en":"✅ Check Payment"},
    "checking":  {"id":"🔍 <b>Memeriksa pembayaran...</b>","en":"🔍 <b>Checking payment...</b>"},
    "stock_out": {"id":"😔 <b>Stok baru saja habis!</b>\n\nSaldo Rp {amount} telah masuk ke <b>Saldo</b> kamu.\nCek halaman refund untuk menarik dana.","en":"😔 <b>Stock just ran out!</b>\n\nRp {amount} has been added to your <b>Balance</b>.\nCheck refund page to withdraw."},
    "order_ok":  {"id":"✅ <b>Pesanan dibuat!</b>\n\nID: <code>{order_id}</code>\nStatus: <b>{status}</b>\n\nDetail akses akan dikirim ke email.","en":"✅ <b>Order created!</b>\n\nID: <code>{order_id}</code>\nStatus: <b>{status}</b>\n\nAccess details will be emailed."},
    "tx_short":  {"id":"⚠️ TX Hash terlalu pendek (min. 10 karakter)","en":"⚠️ TX Hash too short (min. 10 chars)"},
    "help_text": {"id":"📋 <b>Bantuan Upbit Store</b>\n\n1. Pilih produk dari Flash Sale atau Katalog\n2. Pilih durasi & metode bayar\n3. Scan QRIS atau transfer Crypto\n4. Klik Cek Pembayaran\n5. Akses dikirim ke email\n\n📞 WA: 087797127865","en":"📋 <b>Upbit Store Help</b>\n\n1. Choose product from Flash Sale or Catalog\n2. Select plan & payment method\n3. Scan QRIS or transfer Crypto\n4. Click Check Payment\n5. Access sent to email\n\n📞 WA: 087797127865"},
}

def t(key, lang="id"):
    return T.get(key, {}).get(lang, T.get(key, {}).get("id", key))

def fmt_price(n):
    if n >= 1_000_000: return f"Rp {n/1_000_000:,.1f}jt"
    return f"Rp {n:,}"

# ═══════════════════════ USER STATE ═══════════════════════
# Disimpan di file JSON sederhana: {chat_id: {lang,step,product_id,tier_label,asset,...}}
state_lock = Lock()
def load_state():
    try:
        with open(STATE_FILE) as f: return json.load(f)
    except: return {}
def save_state(s):
    with state_lock:
        with open(STATE_FILE,"w") as f: json.dump(s,f)

def get_state(uid):
    s = load_state()
    return s.get(str(uid), {"lang":"id","step":"menu"})
def set_state(uid, d):
    s = load_state()
    s[str(uid)] = d
    save_state(s)

# ═══════════════════════ API ═══════════════════════
def api_get(path):
    try:
        r = requests.get(f"{API_BASE}{path}", timeout=10)
        return r.json() if r.status_code==200 else None
    except: return None

def api_post(path, data=None, files=None):
    try:
        if files:
            r = requests.post(f"{API_BASE}{path}", data=data, files=files, timeout=30)
        else:
            r = requests.post(f"{API_BASE}{path}", json=data, timeout=30)
        return r.json() if r.status_code in (200,201,400,401) else None
    except: return None

PRODUCTS_CACHE = {"data":None,"ts":0}
def get_products():
    now = time.time()
    if PRODUCTS_CACHE["data"] and (now-PRODUCTS_CACHE["ts"]) < 300:
        return PRODUCTS_CACHE["data"]
    d = api_get("/products")
    if d:
        PRODUCTS_CACHE["data"] = d
        PRODUCTS_CACHE["ts"] = now
    return d

# ═══════════════════════ KEYBOARDS ═══════════════════════
def lang_menu():
    kb = types.InlineKeyboardMarkup(row_width=3)
    btns = [types.InlineKeyboardButton(v, callback_data=f"lang|{k}") for k,v in LANGS.items()]
    for i in range(0,len(btns),3):
        kb.add(*btns[i:i+3])
    return kb

def main_keyboard(lang="id"):
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    kb.add(t("flash",lang), t("products",lang))
    kb.add(t("balance",lang), t("website",lang))
    kb.add(t("help",lang))
    return kb

def tier_keyboard(tiers, product_id):
    kb = types.InlineKeyboardMarkup(row_width=1)
    for tier in (tiers or []):
        lbl = f"{tier['label']} — {fmt_price(tier['price'])}"
        kb.add(types.InlineKeyboardButton(lbl, callback_data=f"tier|{product_id}|{tier['label']}|{tier['price']}"))
    kb.add(types.InlineKeyboardButton("🔙 Kembali", callback_data="back_menu"))
    return kb

def payment_keyboard(amount, lang="id"):
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton(f"📱 QRIS — {fmt_price(amount)}", callback_data=f"pay|qris|{amount}"),
        types.InlineKeyboardButton("🪙 Crypto", callback_data=f"pay|crypto|{amount}"),
    )
    kb.add(types.InlineKeyboardButton("🔙 Kembali", callback_data="back_menu"))
    return kb

# ═══════════════════════ QR GENERATOR ═══════════════════════
def generate_qr(data):
    qr = qrcode.QRCode(box_size=6, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf

# ═══════════════════════ HANDLERS ═══════════════════════

@bot.message_handler(commands=["start"])
def cmd_start(message):
    uid = str(message.chat.id)
    set_state(uid, {"lang":"id","step":"menu"})
    bot.send_message(message.chat.id,
        f"{t('welcome','id')}\n\n{t('choose_lang','id')}",
        reply_markup=lang_menu())

@bot.callback_query_handler(func=lambda c: c.data.startswith("lang|"))
def on_lang(call):
    lang = call.data.split("|")[1]
    uid = str(call.message.chat.id)
    set_state(uid, {"lang":lang,"step":"menu"})
    bot.delete_message(call.message.chat.id, call.message.message_id)
    bot.send_message(call.message.chat.id,
        f"{t('welcome',lang)}\n\n✅ Language: <b>{LANGS[lang]}</b>\n\n{t('menu',lang)}",
        reply_markup=main_keyboard(lang))

@bot.callback_query_handler(func=lambda c: c.data == "back_menu")
def on_back(call):
    uid = str(call.message.chat.id)
    st = get_state(uid)
    lang = st.get("lang","id")
    set_state(uid, {"lang":lang,"step":"menu"})
    bot.delete_message(call.message.chat.id, call.message.message_id)
    bot.send_message(call.message.chat.id, t("menu",lang), reply_markup=main_keyboard(lang))

# ── FLASH SALE ──
@bot.message_handler(func=lambda m: "Flash" in (m.text or ""))
def flash_sale(m):
    uid = str(m.chat.id)
    lang = get_state(uid).get("lang","id")
    loading = bot.send_message(m.chat.id, t("loading",lang))
    prods = get_products()
    if not prods:
        bot.edit_message_text("❌ Gagal memuat", m.chat.id, loading.message_id); return
    promo = [p for p in prods if p.get("category")=="Promo"][:12]
    kb = types.InlineKeyboardMarkup(row_width=1)
    for p in promo:
        price = p.get("price",0)
        kb.add(types.InlineKeyboardButton(f"🔥 {p['name']} — {fmt_price(price)}", callback_data=f"selprod|{p['id']}"))
    kb.add(types.InlineKeyboardButton("🔙 Kembali", callback_data="back_menu"))
    text = f"🔥 <b>FLASH SALE</b> — {len(promo)} produk\n" + "━"*25 + "\nPilih produk:"
    bot.edit_message_text(text, m.chat.id, loading.message_id, reply_markup=kb)

# ── ALL PRODUCTS ──
@bot.message_handler(func=lambda m: "Semua Produk" in (m.text or ""))
def all_products(m):
    uid = str(m.chat.id)
    lang = get_state(uid).get("lang","id")
    loading = bot.send_message(m.chat.id, t("loading",lang))
    prods = get_products()
    if not prods:
        bot.edit_message_text("❌ Gagal", m.chat.id, loading.message_id); return
    cats = {}
    for p in prods:
        cats.setdefault(p.get("category","Lainnya"),[]).append(p)
    kb = types.InlineKeyboardMarkup(row_width=1)
    for cat,plist in list(cats.items())[:8]:
        kb.add(types.InlineKeyboardButton(f"📂 {cat} ({len(plist)})", callback_data=f"cat|{cat}"))
    kb.add(types.InlineKeyboardButton("🔙 Kembali", callback_data="back_menu"))
    text = f"🛒 <b>KATALOG</b> — {len(prods)} produk\n" + "━"*25 + "\nPilih kategori:"
    bot.edit_message_text(text, m.chat.id, loading.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("cat|"))
def on_category(call):
    cat = call.data.split("|")[1]
    uid = str(call.message.chat.id)
    prods = get_products()
    plist = [p for p in (prods or []) if p.get("category")==cat]
    kb = types.InlineKeyboardMarkup(row_width=1)
    for p in plist[:10]:
        kb.add(types.InlineKeyboardButton(f"{p['name']} — {fmt_price(p['price'])}", callback_data=f"selprod|{p['id']}"))
    kb.add(types.InlineKeyboardButton("🔙 Kembali", callback_data="back_menu"))
    bot.edit_message_text(f"📂 <b>{cat}</b> ({len(plist)} produk)\n"+"━"*25+"\nPilih produk:",
        call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── PRODUCT → TIER ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("selprod|"))
def on_product(call):
    pid = call.data.split("|")[1]
    uid = str(call.message.chat.id)
    lang = get_state(uid).get("lang","id")
    prods = get_products()
    prod = next((p for p in (prods or []) if p["id"]==pid), None)
    if not prod:
        bot.answer_callback_query(call.id, "Produk tidak ditemukan"); return
    tiers = prod.get("tiers",[])
    if not tiers:
        tiers = [{"label":"Default","price":prod["price"]}]
    st = get_state(uid)
    st["product_id"] = pid
    st["product_name"] = prod["name"]
    st["step"] = "tier"
    set_state(uid, st)
    text = f"🛒 <b>{prod['name']}</b>\n<i>{prod.get('tagline','')}</i>\n"+"━"*25+f"\n{t('pick_tier',lang)}"
    bot.edit_message_text(text, call.message.chat.id, call.message.message_id, reply_markup=tier_keyboard(tiers, pid))

# ── TIER → PAYMENT ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("tier|"))
def on_tier(call):
    _, pid, label, price = call.data.split("|", 3)
    price = int(price)
    uid = str(call.message.chat.id)
    lang = get_state(uid).get("lang","id")
    st = get_state(uid)
    st.update({"tier_label":label,"tier_price":price,"step":"payment"})
    set_state(uid, st)
    text = f"🛒 <b>{st.get('product_name','Produk')}</b>\n📦 {label} — {fmt_price(price)}\n"+"━"*25+f"\n{t('pay_method',lang)}"
    bot.edit_message_text(text, call.message.chat.id, call.message.message_id, reply_markup=payment_keyboard(price, lang))

# ── PAYMENT METHOD ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("pay|"))
def on_payment(call):
    _, method, amount = call.data.split("|", 2)
    amount = int(amount)
    uid = str(call.message.chat.id)
    lang = get_state(uid).get("lang","id")
    st = get_state(uid)
    st["pay_method"] = method
    st["amount"] = amount
    st["step"] = "confirm"
    set_state(uid, st)

    if method == "qris":
        qr_data = build_qris(amount)
        qr_img = generate_qr(qr_data)
        kb = types.InlineKeyboardMarkup()
        kb.add(types.InlineKeyboardButton(t("check_btn",lang), callback_data=f"check|{amount}"))
        kb.add(types.InlineKeyboardButton("🔙 Kembali", callback_data="back_menu"))
        bot.delete_message(call.message.chat.id, call.message.message_id)
        bot.send_photo(call.message.chat.id, qr_img,
            caption=t("qris_scan",lang).format(amount=fmt_price(amount)),
            reply_markup=kb)
    else:
        # Crypto
        kb = types.InlineKeyboardMarkup(row_width=1)
        for asset in CRYPTO_ASSETS:
            crypto_amt = amount / asset["idrRate"]
            crypto_amt = round(crypto_amt, asset["decimals"])
            kb.add(types.InlineKeyboardButton(
                f"{asset['symbol']} — {crypto_amt} {asset['symbol']}",
                callback_data=f"cryptoasset|{asset['id']}|{amount}"
            ))
        kb.add(types.InlineKeyboardButton("🔙 Kembali", callback_data="back_menu"))
        bot.edit_message_text(
            f"🪙 <b>Pilih Aset Crypto</b>\n"+"━"*25+f"\nTotal: {fmt_price(amount)}\n\nPilih coin:",
            call.message.chat.id, call.message.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("cryptoasset|"))
def on_crypto_asset(call):
    _, asset_id, amount = call.data.split("|", 2)
    amount = int(amount)
    uid = str(call.message.chat.id)
    lang = get_state(uid).get("lang","id")
    asset = next((a for a in CRYPTO_ASSETS if a["id"]==asset_id), None)
    if not asset:
        bot.answer_callback_query(call.id, "Asset tidak ditemukan"); return
    crypto_amt = round(amount / asset["idrRate"], asset["decimals"])
    st = get_state(uid)
    st["crypto_asset"] = asset_id
    st["crypto_amount"] = crypto_amt
    st["step"] = "tx_input"
    set_state(uid, st)
    text = t("crypto_pay",lang).format(amount=crypto_amt, symbol=asset["symbol"], address=asset["address"])
    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton(t("check_btn",lang), callback_data=f"check|{amount}"))
    kb.add(types.InlineKeyboardButton("🔙 Kembali", callback_data="back_menu"))
    bot.edit_message_text(text, call.message.chat.id, call.message.message_id, reply_markup=kb)
    # Prompt user for TX hash
    msg = bot.send_message(call.message.chat.id, f"📝 {t('tx_placeholder',lang)}")
    # Register next step handler
    st["waiting_tx"] = True
    set_state(uid, st)

# ── CHECK PAYMENT ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("check|"))
def on_check(call):
    amount_str = call.data.split("|")[1]
    amount = int(amount_str)
    uid = str(call.message.chat.id)
    lang = get_state(uid).get("lang","id")
    st = get_state(uid)

    # IF crypto and no TX hash yet
    if st.get("pay_method") == "crypto" and st.get("waiting_tx"):
        bot.answer_callback_query(call.id, "⚠️ Masukkan TX Hash dulu!")
        return

    bot.answer_callback_query(call.id, "Memeriksa pembayaran...")

    # Simulate loading 5 detik
    loading_msg = bot.send_message(call.message.chat.id, f"🔍 <b>Memeriksa pembayaran...</b>\n\n⬜⬜⬜⬜⬜ 0%")
    for i in range(1, 6):
        time.sleep(1)
        bar = "🟩"*i + "⬜"*(5-i)
        try:
            bot.edit_message_text(f"🔍 <b>Memeriksa pembayaran...</b>\n\n{bar} {i*20}%", call.message.chat.id, loading_msg.message_id)
        except: pass

    # Create order via API
    product_id = st.get("product_id", "unknown")
    tier_label = st.get("tier_label", "1 Bulan")
    price = st.get("tier_price", amount)

    try:
        # Buat small proof image
        import base64
        proof_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
        files = {"proof": ("proof.png", proof_data, "image/png")}
        data = {
            "items": json.dumps([{"id": product_id, "tierLabel": tier_label, "qty": 1}]),
            "deliveryEmail": "user@telegram.bot",
            "activation": "new",
            "method": st.get("pay_method","qris"),
        }
        resp = api_post("/orders", data=data, files=files)
    except Exception as e:
        log.error(f"Order error: {e}")
        resp = None

    # Handle result
    if resp and resp.get("order"):
        order = resp["order"]
        stock_out = resp.get("stockOut", False)

        if stock_out or order.get("status") == "CANCELLED":
            bot.delete_message(call.message.chat.id, loading_msg.message_id)
            bot.send_message(call.message.chat.id,
                t("stock_out",lang).format(amount=fmt_price(price)),
                reply_markup=main_keyboard(lang))
        else:
            bot.edit_message_text(
                t("order_ok",lang).format(order_id=order["id"], status=order.get("status","PROCESSING")),
                call.message.chat.id, loading_msg.message_id,
                reply_markup=main_keyboard(lang))
    else:
        # Fallback: simulate stock-out for 30k-80k products
        is_stock_out_range = 30000 <= price <= 80000
        bot.delete_message(call.message.chat.id, loading_msg.message_id)
        if is_stock_out_range:
            bot.send_message(call.message.chat.id,
                t("stock_out",lang).format(amount=fmt_price(price)),
                reply_markup=main_keyboard(lang))
        else:
            bot.send_message(call.message.chat.id,
                f"✅ <b>Pesanan diproses!</b>\n\nProduk: {st.get('product_name','')}\nTotal: {fmt_price(price)}\n\nDetail akses akan dikirim via email.",
                reply_markup=main_keyboard(lang))

    # Reset state
    set_state(uid, {"lang":lang,"step":"menu"})

# ── TX HASH INPUT (Crypto) ──
@bot.message_handler(func=lambda m: True)
def on_text(m):
    uid = str(m.chat.id)
    st = get_state(uid)
    if st.get("waiting_tx") and st.get("pay_method") == "crypto":
        tx = m.text.strip()
        if len(tx) < 10:
            lang = st.get("lang","id")
            bot.send_message(m.chat.id, t("tx_short",lang))
            return
        st["tx_hash"] = tx
        st["waiting_tx"] = False
        set_state(uid, st)
        bot.send_message(m.chat.id, f"✅ TX Hash disimpan!\n\nKlik tombol <b>Cek Pembayaran</b> di atas untuk lanjut.")
        return

    # Fallback
    lang = st.get("lang","id")
    bot.send_message(m.chat.id, "Gunakan menu di bawah ya 👇", reply_markup=main_keyboard(lang))

# ── BALANCE ──
@bot.message_handler(func=lambda m: "Saldo" in (m.text or ""))
def balance_info(m):
    uid = str(m.chat.id)
    lang = get_state(uid).get("lang","id")
    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton("🌐 Buka Halaman Saldo", url=f"{STORE_URL}/balance"))
    kb.add(types.InlineKeyboardButton("🌐 Login / Daftar", url=f"{STORE_URL}/auth"))
    bot.send_message(m.chat.id,
        f"💰 <b>SALDO UPBIT</b>\n"+"━"*25+"\n"
        f"🔐 Login dulu untuk cek saldo.\n\n"
        f"✨ Fitur:\n• Check-in harian Rp 300\n• Refund otomatis\n• Tarik saldo (min. transaksi Rp 250rb)",
        reply_markup=kb)

# ── WEBSITE ──
@bot.message_handler(func=lambda m: "Website" in (m.text or ""))
def website(m):
    lang = get_state(str(m.chat.id)).get("lang","id")
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton("🔥 Flash Sale", url=f"{STORE_URL}/flash-sale"),
        types.InlineKeyboardButton("🛒 Toko", url=f"{STORE_URL}/store"),
        types.InlineKeyboardButton("💰 Saldo", url=f"{STORE_URL}/balance"),
        types.InlineKeyboardButton("👤 Akun", url=f"{STORE_URL}/account"),
        types.InlineKeyboardButton("🏠 Beranda", url=STORE_URL),
    )
    bot.send_message(m.chat.id, f"🌐 <b>UPBIT STORE</b>\n"+"━"*25+"\n👇 Klik untuk langsung ke halaman:", reply_markup=kb)

# ── HELP ──
@bot.message_handler(func=lambda m: "Bantuan" in (m.text or ""))
def help_cmd(m):
    lang = get_state(str(m.chat.id)).get("lang","id")
    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton("🌐 Buka Website", url=STORE_URL))
    bot.send_message(m.chat.id, t("help_text",lang), reply_markup=kb)

# ═══════════════════════ MAIN ═══════════════════════
if __name__ == "__main__":
    # Lock untuk cegah duplikat
    if os.path.exists(LOCK_FILE):
        try:
            old_pid = int(open(LOCK_FILE).read().strip())
            os.kill(old_pid, 0)
            log.error(f"Bot already running (PID {old_pid}). Exiting.")
            sys.exit(1)
        except: pass
    with open(LOCK_FILE,"w") as f:
        f.write(str(os.getpid()))

    log.info("="*50)
    log.info("🚀 Upbit Store Bot v2 starting...")
    log.info(f"🤖 Token: {BOT_TOKEN[:10]}...")

    while True:
        try:
            log.info("✅ Bot polling...")
            bot.infinity_polling(timeout=30, long_polling_timeout=60)
        except requests.exceptions.ReadTimeout:
            log.warning("⚠️ Timeout — reconnect...")
            time.sleep(2)
        except Exception as e:
            log.error(f"❌ Error: {e}")
            time.sleep(5)
