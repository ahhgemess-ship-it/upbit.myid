#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# MATIKAN BOT TELEGRAM LAMA DI VPS — aman & idempotent
#
# Latar: bot Telegram produksi pindah ke webhook serverless
# (evolusiai.xyz, bot @evolusiaibot). Bot polling lama (upbit_bot.py
# + watchdog cron) tidak lagi dipakai. Selama webhook aktif, Telegram
# memang menolak polling (409) — script ini menghentikan prosesnya
# total agar tidak spam log/error.
#
# Jalankan di VPS:
#   bash /home/ubuntu/upbit-store/bot/stop_bot_vps.sh
#
# Urutan penting (watchdog cron jalan tiap menit & me-restart bot):
#   1. Bersihkan cron (watchdog.sh tiap menit + @reboot start_bot.sh)
#   2. Kill proses python
#   3. Hapus file lock /tmp
#   4. Verifikasi
#
# Data saldo/state persisten di bot/data TIDAK disentuh.
# ═══════════════════════════════════════════════════════════════

set -u
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "1/4 Bersihkan cron (watchdog & @reboot start_bot)..."
OLD_CRON="$(crontab -l 2>/dev/null || true)"
NEW_CRON="$(printf '%s\n' "$OLD_CRON" | grep -Ev 'watchdog\.sh|start_bot\.sh' || true)"
if [ "$NEW_CRON" = "$OLD_CRON" ]; then
    echo "   (cron sudah bersih — tidak ada baris bot)"
else
    printf '%s\n' "$NEW_CRON" | crontab -
    echo "   cron diperbarui. Sisa cron:"
    crontab -l 2>/dev/null | sed 's/^/     /'
fi

echo "2/4 Matikan proses bot..."
if pgrep -f 'python3 -u upbit_bot\.py' > /dev/null 2>&1; then
    pkill -9 -f 'python3 -u upbit_bot\.py' 2>/dev/null || true
    sleep 2
    echo "   proses dihentikan."
else
    echo "   (proses tidak sedang jalan)"
fi

echo "3/4 Hapus file lock /tmp..."
rm -f /tmp/upbit-bot.lock /tmp/upbit-watchdog.lock

echo "4/4 Verifikasi..."
if pgrep -af 'upbit_bot\.py' > /dev/null 2>&1; then
    echo "❌ MASIH JALAN:"
    pgrep -af 'upbit_bot\.py'
    echo "   Jalankan sekali lagi, atau cek cron lain yang membangkitkan bot."
    exit 1
fi

echo ""
echo "✅ Bot lama mati & cron dibersihkan. Data saldo di $DIR/data tetap utuh."
echo "   Cek ulang ±1 menit lagi (jaga-jaga cron lain):  pgrep -af upbit_bot.py"
