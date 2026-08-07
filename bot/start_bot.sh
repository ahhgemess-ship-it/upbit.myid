#!/bin/bash
# Start Upbit Store Telegram Bot (hanya satu instance)

LOCK="/tmp/upbit-bot.lock"
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/upbit-bot.log"

# Cek apakah sudah running
if [ -f "$LOCK" ]; then
    OLD=$(cat "$LOCK")
    if kill -0 "$OLD" 2>/dev/null; then
        echo "Bot already running (PID $OLD)"
        exit 0
    fi
    rm -f "$LOCK"
fi

# Bunuh instance lama
pkill -9 -f 'upbit_bot.py' 2>/dev/null
sleep 1

# Start di background (subshell agar fully detached)
cd "$DIR"
(nohup python3 upbit_bot.py </dev/null >>"$LOG" 2>&1 &)
sleep 3
PID=$(pgrep -f 'upbit_bot\.py' | head -1)
if [ -n "$PID" ]; then
    echo "$PID" > "$LOCK"
    echo "Bot started (PID $PID)"
else
    echo "Bot failed to start!"
    exit 1
fi
