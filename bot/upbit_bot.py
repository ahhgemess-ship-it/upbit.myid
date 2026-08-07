#!/usr/bin/env python3
"""
Upbit Store Bot — Telegram Bot Resmi
=====================================
Bot Telegram profesional untuk marketplace Upbit Store.
Fitur: produk, flash sale, cek saldo, bantuan, kunjungi website.

Requirements: pip3 install pyTelegramBotAPI requests
"""

import os
import sys
import json
import time
import logging
import hashlib
from datetime import datetime

import telebot
from telebot import types
import requests

# ═══════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════

BOT_TOKEN = "8525098720:AAGwM-Np2aRTIRhryP7fvvo-VChnf5_8GnE"
API_BASE = "https://upbit-store-vert.vercel.app/api"
STORE_URL = "https://upbit-store-vert.vercel.app"

# Logging
LOG_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(LOG_DIR, "upbit-bot.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("upbit-bot")

# Init bot
bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")

# Cache produk (5 menit)
CACHE = {"products": None, "ts": 0}

# ═══════════════════════════════════════════════
# ASSETS
# ═══════════════════════════════════════════════

LOGO = """
<b>⚡ UPBIT STORE</b>
<i>Marketplace Produk Digital #1</i>
"""

DIVIDER = "━━━━━━━━━━━━━━━━━━━"

EMOJI = {
    "cart": "🛒",
    "fire": "🔥",
    "wallet": "💰",
    "help": "ℹ️",
    "web": "🌐",
    "back": "🔙",
    "check": "✅",
    "cross": "❌",
    "loading": "⏳",
    "star": "⭐",
    "clock": "🕐",
    "tag": "🏷️",
    "user": "👤",
    "email": "📧",
    "lock": "🔐",
    "info": "📋",
    "rocket": "🚀",
}

# ═══════════════════════════════════════════════
# API HELPERS
# ═══════════════════════════════════════════════

def api_get(path):
    """GET request ke API Upbit Store"""
    try:
        r = requests.get(f"{API_BASE}{path}", timeout=10)
        if r.status_code == 200:
            return r.json()
        logger.error(f"API {path}: HTTP {r.status_code}")
        return None
    except Exception as e:
        logger.error(f"API {path}: {e}")
        return None


def get_products():
    """Ambil daftar produk (dengan cache 5 menit)"""
    now = time.time()
    if CACHE["products"] and (now - CACHE["ts"]) < 300:
        return CACHE["products"]
    data = api_get("/products")
    if data:
        CACHE["products"] = data
        CACHE["ts"] = now
    return data


def get_balance(user_id):
    """Cek saldo user (perlu integrasi auth nanti)"""
    # Untuk sekarang, saldo tidak bisa dicek tanpa auth token
    # Akan diintegrasikan dengan sistem auth nanti
    return None


def fmt_price(n):
    """Format harga ke IDR"""
    if n >= 1_000_000:
        return f"Rp {n/1_000_000:,.1f}jt"
    return f"Rp {n:,}"


# ═══════════════════════════════════════════════
# KEYBOARDS
# ═══════════════════════════════════════════════

def main_menu():
    """Keyboard utama — tampil setiap saat di bawah chat"""
    kb = types.ReplyKeyboardMarkup(resize_keyboard=True, row_width=2)
    kb.add(
        types.KeyboardButton(f"{EMOJI['fire']} Flash Sale"),
        types.KeyboardButton(f"{EMOJI['cart']} Semua Produk"),
        types.KeyboardButton(f"{EMOJI['wallet']} Saldo Saya"),
        types.KeyboardButton(f"{EMOJI['web']} Kunjungi Website"),
        types.KeyboardButton(f"{EMOJI['help']} Bantuan"),
    )
    return kb


def product_inline_menu(product_id, tiers):
    """Inline keyboard untuk pilih tier produk"""
    kb = types.InlineKeyboardMarkup(row_width=2)
    buttons = []
    for t in (tiers or []):
        label = f"{t['label']} — {fmt_price(t['price'])}"
        buttons.append(types.InlineKeyboardButton(
            label, callback_data=f"tier|{product_id}|{t['label']}"
        ))
    for i in range(0, len(buttons), 2):
        kb.add(*buttons[i : i + 2])
    kb.add(types.InlineKeyboardButton(
        f"{EMOJI['web']} Beli di Website",
        url=f"{STORE_URL}/product/{product_id}"
    ))
    return kb


# ═══════════════════════════════════════════════
# REPLY MARKUP (Main Menu)
# ═══════════════════════════════════════════════

@bot.message_handler(commands=["start", "menu"])
def cmd_start(message):
    """Handler /start — tampilkan welcome + menu"""
    user = message.from_user
    text = f"""{LOGO}

<b>👋 Selamat Datang, {user.first_name}!</b>

{DIVIDER}

{EMOJI['rocket']} <b>Beli produk digital premium:</b>
• ChatGPT Plus / Pro
• Claude Pro / Max
• Gemini Pro / Ultra
• Cursor Pro, Kiro AI, & banyak lagi!

{EMOJI['fire']} <b>Flash Sale</b> — diskon hingga 50%
{EMOJI['wallet']} <b>Saldo</b> — check-in harian & refund otomatis
{EMOJI['lock']} <b>Transaksi Aman</b> — konfirmasi otomatis via API

{DIVIDER}

<i>Gunakan menu di bawah untuk navigasi 👇</i>
"""
    bot.send_message(
        message.chat.id, text,
        reply_markup=main_menu(),
        protect_content=False,
    )


# ═══════════════════════════════════════════════
# FLASH SALE
# ═══════════════════════════════════════════════

@bot.message_handler(func=lambda m: m.text and "Flash Sale" in m.text)
def flash_sale(message):
    """Tampilkan produk flash sale"""
    loading = bot.send_message(
        message.chat.id, f"{EMOJI['loading']} <i>Memuat Flash Sale...</i>"
    )
    time.sleep(0.3)

    products = get_products()
    if not products:
        bot.edit_message_text(
            f"{EMOJI['cross']} <b>Gagal memuat produk</b>\nSilakan coba lagi nanti.",
            message.chat.id, loading.message_id,
            reply_markup=main_menu(),
        )
        return

    promo = [p for p in products if p.get("category") == "Promo"]
    if not promo:
        bot.edit_message_text(
            f"{EMOJI['info']} <b>Tidak ada Flash Sale saat ini</b>",
            message.chat.id, loading.message_id,
            reply_markup=main_menu(),
        )
        return

    text = f"""{EMOJI['fire']}<b>  FLASH SALE UPBIT STORE  </b>{EMOJI['fire']}

{DIVIDER}

"""
    for p in promo[:10]:
        tiers_text = " | ".join(
            f"<code>{t['label']}</code> {fmt_price(t['price'])}"
            for t in (p.get("tiers") or [])
        ) or fmt_price(p["price"])
        discount = p.get("discount", 0)
        disc_text = f" <b>-{discount}%</b>" if discount > 0 else ""
        stock = p.get("stock", -1)
        stock_text = f"Stok: {stock}" if stock > 0 else ""
        sold = p.get("sold", 0)
        sold_text = f" | Terjual: {sold}+" if sold > 0 else ""

        text += f"""<b>{p['name']}</b>{disc_text}
<i>{p.get('tagline', '')}</i>
💰 {tiers_text}
📦 {stock_text}{sold_text}

"""

    text += f"""{DIVIDER}
🛒 <i>Klik produk di bawah untuk lihat tier & harga lengkap</i>"""
    
    # Tambah inline keyboard: satu tombol per produk
    kb = types.InlineKeyboardMarkup(row_width=1)
    for p in promo[:10]:
        price = p.get("price", 0)
        kb.add(types.InlineKeyboardButton(
            f"{p['name']} — mulai {fmt_price(price)}",
            callback_data=f"show_product|{p['id']}",
        ))
    kb.add(types.InlineKeyboardButton(
        f"{EMOJI['web']} Lihat Semua Flash Sale",
        url=f"{STORE_URL}/flash-sale",
    ))

    try:
        bot.edit_message_text(
            text, message.chat.id, loading.message_id,
            reply_markup=kb,
        )
    except Exception:
        bot.delete_message(message.chat.id, loading.message_id)
        bot.send_message(message.chat.id, text, reply_markup=kb)


# ═══════════════════════════════════════════════
# SEMUA PRODUK
# ═══════════════════════════════════════════════

@bot.message_handler(func=lambda m: m.text and "Semua Produk" in m.text)
def all_products(message):
    """Tampilkan katalog produk per kategori"""
    loading = bot.send_message(
        message.chat.id, f"{EMOJI['loading']} <i>Memuat katalog...</i>"
    )
    time.sleep(0.3)

    products = get_products()
    if not products:
        bot.edit_message_text(
            f"{EMOJI['cross']} <b>Gagal memuat produk</b>",
            message.chat.id, loading.message_id,
            reply_markup=main_menu(),
        )
        return

    # Group by category
    cats = {}
    for p in products:
        cat = p.get("category", "Lainnya")
        cats.setdefault(cat, []).append(p)

    text = f"""{EMOJI['cart']}<b>  KATALOG PRODUK  </b>{EMOJI['cart']}

{DIVIDER}

"""
    for cat, prods in list(cats.items()):
        text += f"\n📂 <b>{cat}</b> ({len(prods)} produk)\n"
        for p in prods[:3]:
            text += f"  • {p['name']} — {fmt_price(p['price'])}\n"
        if len(prods) > 3:
            text += f"  <i>...dan {len(prods) - 3} lainnya</i>\n"

    text += f"\n{DIVIDER}\n🌐 <b>Total: {len(products)} produk</b>"

    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton(
        f"{EMOJI['web']} Lihat Semua di Website",
        url=f"{STORE_URL}/store",
    ))

    try:
        bot.edit_message_text(
            text, message.chat.id, loading.message_id,
            reply_markup=kb,
        )
    except Exception:
        bot.delete_message(message.chat.id, loading.message_id)
        bot.send_message(message.chat.id, text, reply_markup=kb)


# ═══════════════════════════════════════════════
# SALDO
# ═══════════════════════════════════════════════

@bot.message_handler(func=lambda m: m.text and "Saldo Saya" in m.text)
def balance_info(message):
    """Informasi saldo"""
    loading = bot.send_message(
        message.chat.id, f"{EMOJI['loading']} <i>Mengecek saldo...</i>"
    )
    time.sleep(0.3)

    text = f"""{EMOJI['wallet']}<b>  SALDO UPBIT  </b>{EMOJI['wallet']}

{DIVIDER}

🔐 <b>Untuk cek saldo, silakan login dulu:</b>

1. Kunjungi website Upbit Store
2. Login dengan Google
3. Buka menu <b>Saldo</b>

{DIVIDER}

✨ <b>Fitur Saldo:</b>
• {EMOJI['star']} Check-in harian — dapatkan <b>Rp 300/hari</b>
• 💸 Refund otomatis jika stok habis
• 🏧 Tarik saldo (min. transaksi Rp 250.000)

{DIVIDER}

Cek detail saldo di website 👇
"""
    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton(
        f"{EMOJI['web']} Buka Halaman Saldo",
        url=f"{STORE_URL}/balance",
    ))
    kb.add(types.InlineKeyboardButton(
        f"{EMOJI['web']} Login / Daftar",
        url=f"{STORE_URL}/auth",
    ))

    try:
        bot.edit_message_text(
            text, message.chat.id, loading.message_id,
            reply_markup=kb,
        )
    except Exception:
        bot.delete_message(message.chat.id, loading.message_id)
        bot.send_message(message.chat.id, text, reply_markup=kb)


# ═══════════════════════════════════════════════
# KUNJUNGI WEBSITE
# ═══════════════════════════════════════════════

@bot.message_handler(func=lambda m: m.text and "Kunjungi Website" in m.text)
def visit_website(message):
    """Redirect ke website"""
    kb = types.InlineKeyboardMarkup(row_width=2)
    kb.add(
        types.InlineKeyboardButton(f"{EMOJI['fire']} Flash Sale", url=f"{STORE_URL}/flash-sale"),
        types.InlineKeyboardButton(f"{EMOJI['cart']} Toko", url=f"{STORE_URL}/store"),
    )
    kb.add(
        types.InlineKeyboardButton(f"{EMOJI['wallet']} Saldo", url=f"{STORE_URL}/balance"),
        types.InlineKeyboardButton(f"{EMOJI['user']} Akun", url=f"{STORE_URL}/account"),
    )
    kb.add(types.InlineKeyboardButton(
        f"{EMOJI['web']} Beranda Upbit Store",
        url=STORE_URL,
    ))

    bot.send_message(
        message.chat.id,
        f"""{EMOJI['web']}<b>  UPBIT STORE  </b>{EMOJI['web']}

{DIVIDER}

🚀 Marketplace produk digital premium:
• AI Assistant (ChatGPT, Claude, Gemini)
• Software & Tools Premium
• Aman, Cepat, Terpercaya

{DIVIDER}

👇 <i>Klik menu di bawah untuk langsung ke halaman</i>""",
        reply_markup=kb,
    )


# ═══════════════════════════════════════════════
# BANTUAN
# ═══════════════════════════════════════════════

@bot.message_handler(func=lambda m: m.text and "Bantuan" in m.text)
def help_menu(message):
    """Menu bantuan"""
    text = f"""{EMOJI['help']}<b>  PUSAT BANTUAN  </b>{EMOJI['help']}

{DIVIDER}

📋 <b>FAQ:</b>

<b>1. Bagaimana cara beli?</b>
→ Pilih produk → pilih tier → checkout → upload bukti bayar → konfirmasi → akses dikirim ke email

<b>2. Pembayaran via apa?</b>
→ QRIS, Transfer Bank, E-Wallet

<b>3. Berapa lama proses aktivasi?</b>
→ 5-30 menit setelah konfirmasi pembayaran

<b>4. Bagaimana refund?</b>
→ Saldo otomatis kembali jika stok habis. Bisa ditarik setelah total transaksi Rp 250.000+

<b>5. Stok habis?</b>
→ Hubungi admin untuk info restock

{DIVIDER}

📞 <b>Hubungi Kami:</b>
• 📧 Email: support@upbit.my.id
• 💬 Live Chat: di website Upbit Store

{DIVIDER}

<i>Jam operasional: Senin-Minggu, 08:00-22:00 WIB</i>
"""
    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton(
        f"{EMOJI['web']} Buka Website",
        url=STORE_URL,
    ))

    bot.send_message(message.chat.id, text, reply_markup=kb)


# ═══════════════════════════════════════════════
# INLINE CALLBACKS
# ═══════════════════════════════════════════════

@bot.callback_query_handler(func=lambda call: call.data.startswith("show_product|"))
def show_product_callback(call):
    """Tampilkan detail satu produk"""
    product_id = call.data.split("|")[1]
    products = get_products()

    if not products:
        bot.answer_callback_query(call.id, "Gagal memuat produk", show_alert=False)
        return

    prod = next((p for p in products if p["id"] == product_id), None)
    if not prod:
        bot.answer_callback_query(call.id, "Produk tidak ditemukan", show_alert=False)
        return

    tiers = prod.get("tiers", [])
    tiers_text = "\n".join(
        f"  {EMOJI['tag']} <b>{t['label']}</b> — {fmt_price(t['price'])}"
        for t in tiers
    ) if tiers else f"  {fmt_price(prod['price'])}"

    text = f"""{EMOJI['cart']} <b>{prod['name']}</b>

<i>{prod.get('tagline', '')}</i>

{DIVIDER}

{tiers_text}

{DIVIDER}

📦 Stok: {prod.get('stock', '∞') or '∞'}
🔥 Terjual: {prod.get('sold', 0)}+
"""

    kb = product_inline_menu(product_id, tiers)

    try:
        bot.edit_message_text(
            text, call.message.chat.id, call.message.message_id,
            reply_markup=kb,
        )
    except Exception:
        bot.send_message(call.message.chat.id, text, reply_markup=kb)

    bot.answer_callback_query(call.id)


@bot.callback_query_handler(func=lambda call: call.data.startswith("tier|"))
def tier_callback(call):
    """User memilih tier — arahkan ke website"""
    _, product_id, tier_label = call.data.split("|", 2)
    bot.answer_callback_query(call.id, f"Membuka halaman pembelian untuk {tier_label}...")
    bot.send_message(
        call.message.chat.id,
        f"""{EMOJI['rocket']} <b>Lanjutkan ke Website</b>

Produk: <b>{tier_label}</b>
Klik tombol di bawah untuk checkout 👇""",
        reply_markup=types.InlineKeyboardMarkup().add(
            types.InlineKeyboardButton(
                f"{EMOJI['cart']} Checkout Sekarang",
                url=f"{STORE_URL}/product/{product_id}",
            )
        ),
    )


# ═══════════════════════════════════════════════
# FALLBACK — Text yang tidak dikenali
# ═══════════════════════════════════════════════

@bot.message_handler(func=lambda m: True)
def fallback(message):
    """Balas pesan yang tidak dikenali dengan bantuan"""
    bot.send_message(
        message.chat.id,
        f"{EMOJI['info']} <i>Gunakan menu di bawah untuk navigasi ya! 👇</i>",
        reply_markup=main_menu(),
    )


# ═══════════════════════════════════════════════
# MAIN — Run Bot
# ═══════════════════════════════════════════════

if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("🚀 Starting Upbit Store Telegram Bot...")
    logger.info(f"🤖 Bot Token: {BOT_TOKEN[:10]}...")
    logger.info(f"🌐 API Base: {API_BASE}")
    logger.info(f"🏪 Store URL: {STORE_URL}")
    logger.info("=" * 50)

    while True:
        try:
            logger.info("✅ Bot running — menunggu pesan...")
            bot.infinity_polling(
                timeout=30,
                long_polling_timeout=60,
                logger_level=logging.INFO,
            )
        except requests.exceptions.ReadTimeout:
            logger.warning("⚠️ Timeout — reconnect...")
            time.sleep(2)
        except Exception as e:
            logger.error(f"❌ Bot error: {e}")
            time.sleep(5)
