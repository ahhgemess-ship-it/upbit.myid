#!/bin/bash
# ═══════════════════════════════════════════════
# UPBIT BOT WATCHDOG — 24/7 Auto-Restart
# ═══════════════════════════════════════════════
# Dipanggil setiap menit via cron.
# Cek apakah bot hidup. Kalau mati → restart.

LOCK="/tmp/upbit-bot.lock"
DIR="/home/ubuntu/upbit-store/bot"
LOG="$DIR/watchdog.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

# 1. Cek dari lock file
if [ -f "$LOCK" ]; then
    PID=$(cat "$LOCK" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        # Bot hidup — tidak perlu restart
        exit 0
    fi
fi

# 2. Cek dari pgrep (fallback)
if pgrep -f 'upbit_bot\.py' > /dev/null 2>&1; then
    PID=$(pgrep -f 'upbit_bot\.py' | head -1)
    echo "$PID" > "$LOCK"
    exit 0
fi

# 3. Bot mati — RESTART
log "⚠️ Bot mati! Restarting..."
pkill -9 -f upbit_bot.py 2>/dev/null
sleep 2
rm -f "$LOCK" /tmp/upbit-bot-state.json

cd "$DIR"
nohup python3 -u upbit_bot.py </dev/null >>upbit-bot.log 2>&1 &
disown
sleep 4

PID=$(pgrep -f 'upbit_bot\.py' | head -1)
if [ -n "$PID" ]; then
    echo "$PID" > "$LOCK"
    log "✅ Bot restarted (PID $PID)"
else
    log "❌ GAGAL restart bot!"
fi
