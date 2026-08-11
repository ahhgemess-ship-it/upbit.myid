#!/bin/bash
# Start bot (dipakai @reboot & manual). Data saldo/state PERSISTEN di bot/data — tidak dihapus.
LOCK="/tmp/upbit-bot.lock"
DIR="$(cd "$(dirname "$0")" && pwd)"

pkill -9 -f 'python3 -u upbit_bot\.py' 2>/dev/null
sleep 2
rm -f "$LOCK"

cd "$DIR"
nohup python3 -u upbit_bot.py </dev/null >>upbit-bot.log 2>&1 &
disown
sleep 4

PID=$(pgrep -f 'python3 -u upbit_bot\.py' | head -1)
if [ -n "$PID" ]; then
    echo "$PID" > "$LOCK"
    md5sum "$DIR/upbit_bot.py" | awk '{print $1}' > "$DIR/data/.bot-md5"
    echo "Bot started (PID $PID)"
else
    echo "Bot failed!"
    exit 1
fi
