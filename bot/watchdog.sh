#!/bin/bash
# ═══════════════════════════════════════════════
# UPBIT BOT WATCHDOG — 24/7 Auto-Restart + Auto-Reload
# Dipanggil setiap menit via cron.
# 1. Bot mati → restart
# 2. Kode upbit_bot.py berubah (mis. habis git pull) → restart otomatis
# flock mencegah 2 watchdog berjalan bersamaan (anti race / anti flapping)
# ═══════════════════════════════════════════════

exec 9>/tmp/upbit-watchdog.lock
flock -n 9 || exit 0   # watchdog lain sedang berjalan → skip

LOCK="/tmp/upbit-bot.lock"
DIR="/home/ubuntu/upbit-store/bot"
LOG="$DIR/watchdog.log"
PY="$DIR/upbit_bot.py"
META="$DIR/data/.bot-md5"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

bot_pid() { pgrep -f 'python3 -u upbit_bot\.py' | head -1; }

restart() {
    log "🔄 Restarting bot..."
    pkill -9 -f 'python3 -u upbit_bot\.py' 2>/dev/null
    sleep 2
    rm -f "$LOCK"
    cd "$DIR" || exit 1
    nohup python3 -u upbit_bot.py </dev/null >>upbit-bot.log 2>&1 &
    disown
    sleep 4
    PID=$(bot_pid)
    if [ -n "$PID" ]; then
        echo "$PID" > "$LOCK"
        md5sum "$PY" | awk '{print $1}' > "$META"
        log "✅ Bot restarted (PID $PID)"
    else
        log "❌ GAGAL restart bot!"
    fi
}

# 1. Bot mati? → restart
PID=$(bot_pid)
if [ -z "$PID" ]; then
    restart
    exit 0
fi

# 2. Kode berubah? → restart (auto-reload setelah deploy/pull)
if [ -f "$PY" ] && [ -f "$META" ]; then
    CUR=$(md5sum "$PY" | awk '{print $1}')
    OLD=$(cat "$META" 2>/dev/null)
    if [ "$CUR" != "$OLD" ]; then
        log "⚠️ Kode berubah! Auto-restart..."
        restart
        exit 0
    fi
fi

# 3. Bot hidup & sinkron → perbarui lock
echo "$PID" > "$LOCK"
