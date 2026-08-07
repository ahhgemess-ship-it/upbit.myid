#!/bin/bash
LOCK="/tmp/upbit-bot.lock"
DIR="$(cd "$(dirname "$0")" && pwd)"

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
    echo "Bot started (PID $PID)"
else
    echo "Bot failed!"
    exit 1
fi
