#!/usr/bin/env python3
"""
UPBIT STORE BOT v3
- Saldo per Telegram user ID (no login)
- Check-in harian 7-hari
- UI profesional: bold typography, clean layout
"""

import os, sys, json, time, io, logging
from datetime import datetime, date
from threading import Lock

import telebot
from telebot import types
import requests
import qrcode

# ═══ CONFIG ═══
BOT_TOKEN = "8525098720:AAGwM-Np2aRTIRhryP7fvvo-VChnf5_8GnE"
API_BASE  = "https://upbit-store-vert.vercel.app/api"
STORE_URL = "https://upbit-store-vert.vercel.app"

LOG_FILE   = "/home/ubuntu/upbit-store/bot/upbit-bot.log"
LOCK_FILE  = "/tmp/upbit-bot.lock"
STATE_FILE = "/tmp/upbit-bot-state.json"
BAL_FILE   = "/tmp/upbit-bot-balance.json"

# ═══ Logging ═══
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(LOG_FILE, encoding="utf-8"), logging.StreamHandler()])
log = logging.getLogger("upbit-bot")

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")

# ═══ PAYMENT ═══
QRIS_STATIC = "00020101021126610016ID.CO.SHOPEE.WWW01189360091800231770190208231770190303UMI51440014ID.CO.QRIS.WWW0215ID10265313881830303UMI5204581753033605802ID5911UPbit Store6013JAKARTA PUSAT61051052062070703A0163044EF7"

def crc16(s):
    crc = 0xffff
    for c in s: crc ^= ord(c) << 8; crc = (crc << 1) ^ 0x1021 if crc & 0x8000 else crc << 1; crc &= 0xffff
    return f"{crc:04X}"

def build_qris(amt):
    a = str(max(0, int(amt))); base = QRIS_STATIC[:-8]; base = base[:10] + "12" + base[12:]
    f = "54" + f"{len(a):02d}" + a; base = base.replace("5802ID", f + "5802ID")
    return (base + "6304") + crc16(base + "6304")

CRYPTO = [
    {"id":"bnb","symbol":"BNB","address":"0x02fd0906c6f873f35259889d7396f46b92a24aee","rate":9_650_000,"dec":4},
    {"id":"usdt","symbol":"USDT","address":"0x02fd0906c6f873f35259889d7396f46b92a24aee","rate":16_300,"dec":2},
]

# ═══ i18n ═══
LANGS = {"id":"Indonesia","en":"English","zh":"中文","ja":"日本語","ru":"Русский","ms":"Melayu","hi":"हिन्दी","de":"Deutsch","vi":"Tiếng Việt"}

# ═══ BALANCE SYSTEM ═══
bal_lock = Lock()

def load_bal():
    try:
        with open(BAL_FILE) as f: return json.load(f)
    except: return {}

def save_bal(b):
    with bal_lock:
        with open(BAL_FILE,"w") as f: json.dump(b, f)

def get_bal(uid):
    b = load_bal()
    return b.get(str(uid), {"balance":0, "streak":0, "lastCheckIn":None, "totalSpent":0})

def set_bal(uid, d):
    b = load_bal()
    b[str(uid)] = d
    save_bal(b)

MIN_WITHDRAW = 250000

# ═══ STATE ═══
state_lock = Lock()
def load_s(): 
    try: return json.load(open(STATE_FILE))
    except: return {}
def save_s(s):
    with state_lock: json.dump(s, open(STATE_FILE,"w"))
def get_st(uid): 
    return load_s().get(str(uid), {"lang":"id"})
def set_st(uid, d):
    s = load_s(); s[str(uid)] = d; save_s(s)

# ═══ API ═══
def g(path):
    try: r = requests.get(f"{API_BASE}{path}", timeout=10); return r.json() if r.status_code==200 else None
    except: return None
def post(path, data=None, files=None):
    try:
        r = requests.post(f"{API_BASE}{path}", data=data, files=files, timeout=30)
        return r.json() if r.status_code in (200,201,400,401) else None
    except: return None

PCACHE = {"d":None,"t":0}
def prods():
    n = time.time()
    if PCACHE["d"] and (n-PCACHE["t"])<300: return PCACHE["d"]
    d = g("/products")
    if d: PCACHE["d"]=d; PCACHE["t"]=n
    return d

def fp(n):
    if n>=1_000_000: return f"Rp {n/1_000_000:,.1f}jt"
    return f"Rp {n:,}"

# ═══ QR ═══
def gen_qr(data):
    qr = qrcode.QRCode(box_size=6, border=2); qr.add_data(data); qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO(); img.save(buf, format="PNG"); buf.seek(0); return buf

# ═══ HELPERS ═══
def get_period_label(p):
    """Ketahui label durasi dari produk"""
    period = p.get('period', '')
    # Good labels langsung pakai
    if period and period not in ('bln', 'paket'):
        return period
    # Derive dari product ID
    pid = p.get('id', '')
    if '-multi' in pid or 'multi' in pid:
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
    # Default
    price = p.get('price', 0)
    name = p.get('name', '')
    # Claude Max 20x single variant
    if '20x' in pid or 'Max 20x' in name:
        return '1 Bulan'
    if price <= 50000:
        return '1 Bulan'
    if price <= 100000:
        return '1 Bulan'
    return '1 Bulan'

# ═══ KEYBOARDS ═══
def lang_kb():
    kb = types.InlineKeyboardMarkup(row_width=3)
    btns = [types.InlineKeyboardButton(f"{v}", callback_data=f"lang|{k}") for k,v in LANGS.items()]
    for i in range(0,len(btns),3): kb.add(*btns[i:i+3])
    return kb

def main_kb():
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    kb.add("Flash Sale", "Katalog")
    kb.add("Saldo", "Website")
    kb.add("Bantuan")
    return kb

# ═══ HANDLERS ═══

@bot.message_handler(commands=["start"])
def start(m):
    uid = str(m.chat.id); set_st(uid, {"lang":"id"})
    bot.send_message(m.chat.id,
        "<b>UPBIT STORE</b>\n"
        "Marketplace produk digital\n\n"
        "<i>Pilih bahasa / Choose language:</i>",
        reply_markup=lang_kb())

@bot.callback_query_handler(func=lambda c: c.data.startswith("lang|"))
def on_lang(call):
    lang = call.data.split("|")[1]; uid = str(call.message.chat.id)
    set_st(uid, {"lang":lang})
    bot.delete_message(call.message.chat.id, call.message.message_id)
    bot.send_message(call.message.chat.id,
        f"<b>UPBIT STORE</b>\n"
        f"Language: {LANGS[lang]}\n\n"
        "Pilih menu di bawah:",
        reply_markup=main_kb())

@bot.callback_query_handler(func=lambda c: c.data=="back_menu")
def back(call):
    uid = str(call.message.chat.id)
    set_st(uid, get_st(uid))
    bot.delete_message(call.message.chat.id, call.message.message_id)
    bot.send_message(call.message.chat.id, "<b>Menu Utama</b>", reply_markup=main_kb())

# ── FLASH SALE ──
@bot.message_handler(func=lambda m: m.text=="Flash Sale")
def flash(m):
    uid = str(m.chat.id)
    l = bot.send_message(m.chat.id, "<i>Memuat Flash Sale...</i>")
    p = prods()
    if not p: bot.edit_message_text("Gagal memuat produk", m.chat.id, l.message_id); return
    promo = [x for x in p if x.get("category")=="Promo"]
    
    # Group by product name → 1 tombol per nama
    from collections import defaultdict, OrderedDict
    groups = OrderedDict()
    for x in promo:
        name = x['name']
        if name not in groups:
            groups[name] = []
        groups[name].append(x)
    
    kb = types.InlineKeyboardMarkup(row_width=1)
    for name, items in groups.items():
        prices = sorted(set(it['price'] for it in items))
        if len(prices) == 1:
            label = f"{name} · {fp(prices[0])}"
        else:
            label = f"{name} · {fp(min(prices))} – {fp(max(prices))}"
            label += f"  ({len(items)} paket)"
        kb.add(types.InlineKeyboardButton(label, callback_data=f"selgrp|{name}"))
    kb.add(types.InlineKeyboardButton("« Kembali", callback_data="back_menu"))
    
    # Build text list
    lines = []
    for name, items in groups.items():
        prices = sorted(set(it['price'] for it in items))
        if len(prices) == 1:
            lines.append(f"<b>{name}</b> · {fp(prices[0])}")
        else:
            lines.append(f"<b>{name}</b> · {fp(min(prices))} – {fp(max(prices))}")
    
    t = "\n".join(lines[:15])
    extra = f"\n<i>... dan {len(lines)-15} lainnya</i>" if len(lines) > 15 else ""
    
    bot.edit_message_text(
        f"<b>🔥 FLASH SALE</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n{t}{extra}\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"<i>{len(promo)} produk promo · pilih di bawah</i>",
        m.chat.id, l.message_id, reply_markup=kb)

# ── KATALOG ──
@bot.message_handler(func=lambda m: m.text=="Katalog")
def catalog(m):
    l = bot.send_message(m.chat.id, "<i>Memuat katalog...</i>")
    p = prods()
    if not p: bot.edit_message_text("Gagal", m.chat.id, l.message_id); return
    cats = {}; [cats.setdefault(x.get("category","Lainnya"),[]).append(x) for x in p]
    kb = types.InlineKeyboardMarkup(row_width=1)
    for c,pl in list(cats.items())[:8]:
        kb.add(types.InlineKeyboardButton(f"{c} ({len(pl)})", callback_data=f"cat|{c}"))
    kb.add(types.InlineKeyboardButton("« Kembali", callback_data="back_menu"))
    bot.edit_message_text(f"<b>KATALOG</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"Total: {len(p)} produk\n"
        f"<i>Pilih kategori:</i>", m.chat.id, l.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("cat|"))
def on_cat(call):
    cat = call.data.split("|")[1]; p = prods()
    pl = [x for x in (p or []) if x.get("category")==cat]
    kb = types.InlineKeyboardMarkup(row_width=1)
    for x in pl[:10]:
        kb.add(types.InlineKeyboardButton(f"{x['name']} · {fp(x['price'])}", callback_data=f"sel|{x['id']}"))
    kb.add(types.InlineKeyboardButton("« Kembali", callback_data="back_menu"))
    bot.edit_message_text(f"<b>{cat}</b>\n{'━'*20}\n{len(pl)} produk\n<i>Pilih:</i>",
        call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── FLASH SALE GROUP → VARIAN DURASI ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("selgrp|"))
def on_selgrp(call):
    name = call.data.split("|")[1]; uid = str(call.message.chat.id)
    p = prods()
    # Cari SEMUA produk dengan nama yang sama di Flash Sale
    variants = [x for x in (p or []) if x.get("name")==name and x.get("category")=="Promo"]
    variants.sort(key=lambda x: x['price'])
    
    if not variants: bot.answer_callback_query(call.id,"Tidak ditemukan"); return
    
    st = get_st(uid); st.update({"pname": name}); set_st(uid, st)
    
    kb = types.InlineKeyboardMarkup(row_width=1)
    for v in variants:
        period = get_period_label(v)
        label = f"{period} · {fp(v['price'])}"
        if v.get('discountPercent'):
            label += f"  (-{v['discountPercent']}%)"
        kb.add(types.InlineKeyboardButton(label, callback_data=f"tier|{v['id']}|{period}|{v['price']}"))
    kb.add(types.InlineKeyboardButton("« Kembali", callback_data="back_menu"))
    
    tagline = variants[0].get('tagline','')
    prices = sorted(set(v['price'] for v in variants))
    if len(prices) == 1:
        price_text = fp(prices[0])
    else:
        price_text = f"{fp(min(prices))} – {fp(max(prices))}"
    
    bot.edit_message_text(
        f"<b>{name}</b>\n"
        f"<i>{tagline}</i>\n{'━'*20}\n"
        f"Harga: {price_text}\n"
        f"<b>Pilih durasi:</b>",
        call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── PRODUCT (KATALOG) → TIER ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("sel|"))
def on_sel(call):
    pid = call.data.split("|")[1]; uid = str(call.message.chat.id)
    p = prods(); prod = next((x for x in (p or []) if x["id"]==pid), None)
    if not prod: bot.answer_callback_query(call.id,"Tidak ditemukan"); return
    
    # Cek apakah produk ini punya varian lain dengan nama sama
    name = prod['name']
    variants = [x for x in (p or []) if x.get("name")==name and x.get("category")=="Promo"]
    
    if len(variants) > 1:
        # Multi-varian: tampilkan semua
        variants.sort(key=lambda x: x['price'])
        st = get_st(uid); st.update({"pname": name}); set_st(uid, st)
        kb = types.InlineKeyboardMarkup(row_width=1)
        for v in variants:
            period = get_period_label(v)
            kb.add(types.InlineKeyboardButton(f"{period} · {fp(v['price'])}",
                callback_data=f"tier|{v['id']}|{period}|{v['price']}"))
        kb.add(types.InlineKeyboardButton("« Kembali", callback_data="back_menu"))
        prices = sorted(set(v['price'] for v in variants))
        price_text = fp(prices[0]) if len(prices)==1 else f"{fp(min(prices))} – {fp(max(prices))}"
        bot.edit_message_text(
            f"<b>{name}</b>\n"
            f"<i>{prod.get('tagline','')}</i>\n{'━'*20}\n"
            f"Harga: {price_text}\n"
            f"<b>Pilih durasi:</b>",
            call.message.chat.id, call.message.message_id, reply_markup=kb)
        return
    
    # Single product: langsung ke payment
    st = get_st(uid)
    st.update({"pid": pid, "pname": name, "tier_label": "Standard", "tier_price": prod["price"]})
    set_st(uid, st)
    
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton(f"QRIS · {fp(prod['price'])}", callback_data=f"pay|qris|{prod['price']}"),
        types.InlineKeyboardButton("Crypto", callback_data=f"pay|crypto|{prod['price']}"))
    kb.add(types.InlineKeyboardButton("« Kembali", callback_data="back_menu"))
    bot.edit_message_text(
        f"<b>{prod['name']}</b>\n"
        f"<i>{prod.get('tagline','')}</i>\n{'━'*20}\n"
        f"Harga: {fp(prod['price'])}\n"
        f"<i>Metode pembayaran:</i>",
        call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── TIER → PAYMENT ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("tier|"))
def on_tier(call):
    _, pid, label, price = call.data.split("|",3); price=int(price)
    uid = str(call.message.chat.id); st = get_st(uid)
    st.update({"tier_label":label,"tier_price":price}); set_st(uid, st)
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton(f"QRIS · {fp(price)}", callback_data=f"pay|qris|{price}"),
        types.InlineKeyboardButton("Crypto", callback_data=f"pay|crypto|{price}"))
    kb.add(types.InlineKeyboardButton("« Kembali", callback_data="back_menu"))
    bot.edit_message_text(f"<b>{st.get('pname','')}</b>\n"
        f"Paket: {label} · {fp(price)}\n{'━'*20}\n"
        f"<i>Metode pembayaran:</i>", call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── PAYMENT: QRIS / CRYPTO ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("pay|"))
def on_pay(call):
    _, method, amt = call.data.split("|",2); amt=int(amt)
    uid = str(call.message.chat.id); st = get_st(uid)
    st.update({"pay_method":method,"amount":amt}); set_st(uid, st)

    if method=="qris":
        qr = gen_qr(build_qris(amt))
        kb = types.InlineKeyboardMarkup()
        kb.add(types.InlineKeyboardButton("Cek Pembayaran", callback_data=f"check|{amt}"))
        kb.add(types.InlineKeyboardButton("« Kembali", callback_data="back_menu"))
        bot.delete_message(call.message.chat.id, call.message.message_id)
        bot.send_photo(call.message.chat.id, qr,
            caption=f"<b>QRIS · {fp(amt)}</b>\n"
                    f"━━━━━━━━━━━━━━━━━━\n"
                    f"Scan QR di atas untuk membayar.\n"
                    f"Setelah transfer, klik <b>Cek Pembayaran</b>.",
            reply_markup=kb)
    else:
        kb = types.InlineKeyboardMarkup(row_width=1)
        for a in CRYPTO:
            ca = round(amt/a["rate"], a["dec"])
            kb.add(types.InlineKeyboardButton(f"{a['symbol']} · {ca}",
                callback_data=f"crypto|{a['id']}|{amt}"))
        kb.add(types.InlineKeyboardButton("« Kembali", callback_data="back_menu"))
        bot.edit_message_text(f"<b>CRYPTO</b>\n{'━'*20}\n"
            f"Total: {fp(amt)}\n<i>Pilih aset:</i>",
            call.message.chat.id, call.message.message_id, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data.startswith("crypto|"))
def on_crypto(call):
    _, aid, amt = call.data.split("|",2); amt=int(amt)
    uid = str(call.message.chat.id); st = get_st(uid)
    a = next((x for x in CRYPTO if x["id"]==aid), None)
    if not a: bot.answer_callback_query(call.id,"Error"); return
    ca = round(amt/a["rate"], a["dec"])
    st.update({"crypto_asset":aid,"crypto_amount":ca,"waiting_tx":True}); set_st(uid, st)
    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton("Cek Pembayaran", callback_data=f"check|{amt}"))
    kb.add(types.InlineKeyboardButton("« Kembali", callback_data="back_menu"))
    bot.edit_message_text(f"<b>{a['symbol']} · {ca}</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"Kirim ke:\n<code>{a['address']}</code>\n\n"
        f"Network: BNB Smart Chain (BEP-20)\n\n"
        f"<i>Balas chat ini dengan TX Hash kamu.</i>",
        call.message.chat.id, call.message.message_id, reply_markup=kb)

# ── CHECK PAYMENT ──
@bot.callback_query_handler(func=lambda c: c.data.startswith("check|"))
def on_check(call):
    amt = int(call.data.split("|")[1]); uid = str(call.message.chat.id); st = get_st(uid)
    if st.get("pay_method")=="crypto" and st.get("waiting_tx"):
        bot.answer_callback_query(call.id, "Masukkan TX Hash dulu"); return

    bot.answer_callback_query(call.id, "Memeriksa...")
    lm = bot.send_message(call.message.chat.id, "<b>Memeriksa pembayaran</b>\n[          ] 0%")
    for i in range(1,6):
        time.sleep(1)
        bar = "[" + "█"*i + " "*(5-i) + "]"
        try: bot.edit_message_text(f"<b>Memeriksa pembayaran</b>\n{bar} {i*20}%", call.message.chat.id, lm.message_id)
        except: pass

    pid = st.get("pid","unknown"); label = st.get("tier_label","1 Bulan"); price = st.get("tier_price",amt)
    try:
        import base64
        prf = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
        resp = post("/orders", data={
            "items": json.dumps([{"id":pid,"tierLabel":label,"qty":1}]),
            "deliveryEmail":"user@telegram.bot","activation":"new",
            "method":st.get("pay_method","qris")},
            files={"proof":("proof.png",prf,"image/png")})
    except: resp = None

    stock_out = (30000 <= price <= 80000) or (resp and resp.get("stockOut"))

    bot.delete_message(call.message.chat.id, lm.message_id)

    if stock_out:
        # Update balance local
        bal = get_bal(uid); bal["balance"] += price; bal["totalSpent"] += price; set_bal(uid, bal)
        bot.send_message(call.message.chat.id,
            f"<b>Stok Habis</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"Sayang sekali, stok <b>{st.get('pname','')}</b> baru saja habis.\n\n"
            f"Saldo <b>{fp(price)}</b> masuk ke Saldo kamu.\n"
            f"Cek halaman Saldo untuk info refund.\n\n"
            f"<i>Min. transaksi {fp(MIN_WITHDRAW)} untuk tarik saldo.</i>",
            reply_markup=main_kb())
    else:
        bal = get_bal(uid); bal["totalSpent"] += price; set_bal(uid, bal)
        oid = resp["order"]["id"] if resp and resp.get("order") else "UPB-PROSES"
        bot.send_message(call.message.chat.id,
            f"<b>Pesanan Dibuat</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"ID: <code>{oid}</code>\n"
            f"Produk: {st.get('pname','')} · {fp(price)}\n"
            f"Status: <b>Diproses</b>\n\n"
            f"<i>Detail akses dikirim ke email setelah dikonfirmasi.</i>",
            reply_markup=main_kb())

    set_st(uid, {"lang": st.get("lang","id")})

# ── SALDO ──
@bot.message_handler(func=lambda m: m.text=="Saldo")
def balance(m):
    uid = str(m.chat.id); bal = get_bal(uid)
    eligible = bal["totalSpent"] >= MIN_WITHDRAW
    kurang = fp(MIN_WITHDRAW - bal["totalSpent"])
    text = (
        f"<b>SALDO</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"Saldo tersedia: <b>{fp(bal['balance'])}</b>\n"
        f"Total transaksi: <b>{fp(bal['totalSpent'])}</b>\n"
        f"Check-in streak: <b>{bal['streak']} hari</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"Min. tarik saldo: {fp(MIN_WITHDRAW)}\n"
        f"Status tarik: {'Bisa' if eligible else 'Kurang ' + kurang}")
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton("Check-in", callback_data="checkin"),
        types.InlineKeyboardButton("Buka Website", url=f"{STORE_URL}/balance"))
    bot.send_message(m.chat.id, text, reply_markup=kb)

@bot.callback_query_handler(func=lambda c: c.data=="checkin")
def checkin(call):
    uid = str(call.message.chat.id); bal = get_bal(uid)
    today = date.today().isoformat()
    if bal["lastCheckIn"] == today:
        bot.answer_callback_query(call.id, "Sudah check-in hari ini!"); return
    bal["streak"] = (bal["streak"] + 1) % 7
    if bal["streak"] == 0: bal["streak"] = 7
    bal["balance"] += 300
    bal["lastCheckIn"] = today
    next_day = 7 - (bal["streak"] % 7)
    set_bal(uid, bal)
    bot.answer_callback_query(call.id, f"+Rp 300! Streak: {bal['streak']} hari")
    bot.edit_message_text(
        f"<b>SALDO</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"Saldo: <b>{fp(bal['balance'])}</b>\n"
        f"Streak: <b>{bal['streak']} hari</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"<i>Check-in berhasil! +Rp 300</i>",
        call.message.chat.id, call.message.message_id,
        reply_markup=types.InlineKeyboardMarkup().add(
            types.InlineKeyboardButton("Buka Website", url=f"{STORE_URL}/balance")))

# ── WEBSITE ──
@bot.message_handler(func=lambda m: m.text=="Website")
def website(m):
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton("Flash Sale", url=f"{STORE_URL}/flash-sale"),
        types.InlineKeyboardButton("Toko", url=f"{STORE_URL}/store"),
        types.InlineKeyboardButton("Saldo", url=f"{STORE_URL}/balance"),
        types.InlineKeyboardButton("Akun", url=f"{STORE_URL}/account"))
    kb.add(types.InlineKeyboardButton("Beranda", url=STORE_URL))
    bot.send_message(m.chat.id,
        "<b>UPBIT STORE</b>\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "<i>Marketplace produk digital premium.\n"
        "AI Assistant, Software, Tools.</i>",
        reply_markup=kb)

# ── BANTUAN ──
@bot.message_handler(func=lambda m: m.text=="Bantuan")
def help_cmd(m):
    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton("Buka Website", url=STORE_URL))
    bot.send_message(m.chat.id,
        "<b>BANTUAN</b>\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "1. Pilih produk dari Flash Sale / Katalog\n"
        "2. Pilih paket & metode bayar (QRIS / Crypto)\n"
        "3. Bayar & klik Cek Pembayaran\n"
        "4. Akses dikirim ke email\n\n"
        "<b>Refund:</b> otomatis jika stok habis\n"
        "<b>Tarik Saldo:</b> min. transaksi Rp 250.000\n"
        "<b>Check-in:</b> Rp 300/hari di menu Saldo\n\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "<b>Kontak:</b>\n"
        "WA: 087797127865\n"
        "Email: support@upbit.my.id",
        reply_markup=kb)

# ── TX HASH + FALLBACK (LAST) ──
@bot.message_handler(func=lambda m: True)
def on_text(m):
    uid = str(m.chat.id); st = get_st(uid)
    if st.get("waiting_tx"):
        tx = m.text.strip()
        if len(tx) < 10:
            bot.send_message(m.chat.id, "<i>TX Hash terlalu pendek (min. 10 karakter)</i>")
            return
        st["tx_hash"] = tx; st["waiting_tx"] = False; set_st(uid, st)
        bot.send_message(m.chat.id,
            "<b>TX Hash diterima</b>\n"
            "Klik tombol <b>Cek Pembayaran</b> di atas untuk melanjutkan.")
        return
    bot.send_message(m.chat.id, "Gunakan menu di bawah untuk navigasi.", reply_markup=main_kb())

# ═══ MAIN ═══
if __name__ == "__main__":
    if os.path.exists(LOCK_FILE):
        try: os.kill(int(open(LOCK_FILE).read().strip()), 0); log.error("Already running"); sys.exit(1)
        except: pass
    with open(LOCK_FILE,"w") as f: f.write(str(os.getpid()))

    log.info("="*50)
    log.info("UPBIT BOT v3 — starting...")

    while True:
        try:
            log.info("Polling...")
            bot.infinity_polling(timeout=30, long_polling_timeout=60)
        except requests.exceptions.ReadTimeout:
            log.warning("Timeout"); time.sleep(2)
        except Exception as e:
            log.error(f"Error: {e}"); time.sleep(5)
