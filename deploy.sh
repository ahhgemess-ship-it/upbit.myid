#!/usr/bin/env bash
#
# deploy.sh — Deploy otomatis one-shot untuk upbit-store ke Vercel
#
# Pipeline: build lokal -> deploy prebuilt -> tunggu Ready -> alias -> verify
# (Pipeline ini yang terbukti berhasil; remote build di Vercel selalu gagal/UNKNOWN)
#
# Pemakaian:
#   ./deploy.sh                        # build + deploy + alias upbit.my.id + verify
#   ./deploy.sh --no-alias             # build + deploy saja (tanpa ubah domain)
#   UPBIT_VERCEL_TOKEN=xxx ./deploy.sh # pakai token Vercel lain (default: token project)
#
# CATATAN: pakai env UPBIT_VERCEL_TOKEN (bukan VERCEL_TOKEN) supaya tidak tertimpa
# token akun lain yang mungkin sudah ter-set di environment shell.
#
set -euo pipefail

# ---------- Konfigurasi ----------
SCOPE="remove-82076395"
DOMAIN="upbit.my.id"
TOKEN="${UPBIT_VERCEL_TOKEN}"
MAX_WAIT=150          # detik maksimal menunggu status Ready

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()  { echo -e "${GREEN}✔${NC} $1"; }
warn(){ echo -e "${YELLOW}!${NC} $1"; }
err() { echo -e "${RED}✘${NC} $1"; }

DO_ALIAS=1
for arg in "$@"; do
  case "$arg" in
    --no-alias) DO_ALIAS=0 ;;
    *) warn "Argumen tidak dikenal: $arg"; exit 1 ;;
  esac
done

cd "$(dirname "${BASH_SOURCE[0]}")"
export VERCEL_TOKEN="$TOKEN"

echo "▶ [1/6] Build lokal (vercel build --prod)..."
rm -rf .vercel/output
if ! npx vercel build --prod --scope "$SCOPE" 2>&1 | tail -20; then
  err "Build lokal gagal — cek error di atas."
  exit 1
fi
ok "Build selesai"

echo "▶ [2/6] Normalisasi static (app/ → root) + routes..."
if [ -d .vercel/output/static/app ]; then
  mv .vercel/output/static/app/* .vercel/output/static/
  rmdir .vercel/output/static/app
fi
python3 - <<'PY'
import json
c = json.load(open('.vercel/output/config.json'))
for r in c.get('routes', []):
    if r.get('dest', '').startswith('/app/'):
        r['dest'] = r['dest'].replace('/app/', '/', 1)
json.dump(c, open('.vercel/output/config.json', 'w'), indent=2)
PY
ok "Static & routes siap"

echo "▶ [3/6] Deploy prebuilt ke production..."
URL=""
for attempt in 1 2 3 4 5; do
  OUT=$(npx vercel deploy --prebuilt --prod --yes --scope "$SCOPE" 2>&1 || true)
  URL=$(echo "$OUT" | grep -oE 'https://[a-zA-Z0-9-]+\.vercel\.app' | head -1 || true)
  if [ -n "$URL" ]; then break; fi
  ERR=$(echo "$OUT" | grep -iE 'Error|denied|access' | head -1 || true)
  warn "Percobaan $attempt/5 belum dapat URL — ${ERR:-coba lagi}..."
  [ "$attempt" = "5" ] && { err "Deploy gagal setelah 5 percobaan."; echo "$OUT" | tail -10; exit 1; }
  sleep 20

done
ok "Deploy: $URL"

echo "▶ [4/6] Tunggu status Ready (maks ${MAX_WAIT}s)..."
READY=0
for ((i = 0; i < MAX_WAIT; i += 10)); do
  sleep 10
  ST=$(npx vercel inspect "$URL" --scope "$SCOPE" 2>&1 | grep -m1 -E '^\s+status' || true)
  echo "   ...${ST##* }"
  if echo "$ST" | grep -q 'Ready'; then READY=1; break; fi
done
[ "$READY" = "1" ] && ok "Status Ready" || warn "Status belum Ready — lanjut ke alias & verify"

if [ "$DO_ALIAS" = "1" ]; then
  echo "▶ [5/6] Alias $DOMAIN → $URL"
  if ! npx vercel alias set "$URL" "$DOMAIN" --scope "$SCOPE" 2>&1 | tail -2; then
    err "Alias gagal — domain masih mengarah ke deploy lama."
    exit 1
  fi
  ok "Alias OK"
else
  echo "▶ [5/6] Alias dilewati (--no-alias)"
fi

echo "▶ [6/6] Verifikasi lengkap (frontend + bundle + API)..."
BASE="https://$DOMAIN"
if [ "$DO_ALIAS" = "0" ]; then
  BASE="$URL"
fi

PASS=0; FAIL=0
check() { # check <nama> <hasil> <1/0>
  if [ "$3" = "1" ]; then ok "  $1 — $2"; PASS=$((PASS + 1)); else err "  $1 — $2"; FAIL=$((FAIL + 1)); fi
}

# ── 1. Frontend + SPA routes ──
FRONT=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")
check "Frontend /" "HTTP $FRONT" "$([ "$FRONT" = "200" ] && echo 1 || echo 0)"
for r in store flash-sale about cart; do
  C=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$r")
  check "SPA route /$r" "HTTP $C" "$([ "$C" = "200" ] && echo 1 || echo 0)"
done

# ── 2. Bundle JS: dimuat + berisi marker fitur + tanpa teks demo ──
HTML=$(curl -sL "$BASE/")
JS=$(echo "$HTML" | grep -oP 'assets/[^"]+\.js' | head -1)
if [ -n "$JS" ]; then
  BUNDLE=$(curl -s "$BASE/$JS")
  BYTES=$(echo -n "$BUNDLE" | wc -c)
  check "Bundle $JS" "${BYTES} bytes" "$([ "$BYTES" -gt 10000 ] && echo 1 || echo 0)"
  for marker in checkPayment hintReview; do
    N=$(echo "$BUNDLE" | grep -c "$marker" || true)
    check "Marker '$marker'" "$N×" "$([ "$N" -ge 1 ] && echo 1 || echo 0)"
  done
  for bad in "Demo checkout" "dummy" "simulasi" "tidak ada dana nyata"; do
    N=$(echo "$BUNDLE" | grep -c "$bad" || true)
    check "Teks terlarang '$bad'" "$N×" "$([ "$N" = "0" ] && echo 1 || echo 0)"
  done
else
  err "  Bundle JS tidak ditemukan di HTML"
  FAIL=$((FAIL + 1))
fi

# ── 3. API publik ──
H=$(curl -s "$BASE/api/health")
check "API /api/health" "${H:0:50}" "$(echo "$H" | grep -q '"ok":true' && echo 1 || echo 0)"
P=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/products")
check "API /api/products" "HTTP $P" "$([ "$P" = "200" ] && echo 1 || echo 0)"
C=$(curl -s -X POST -H 'Content-Type: application/json' -d '{}' -o /dev/null -w '%{http_code}' "$BASE/api/coupons/validate")
# Kupon tidak valid sengaja membalas 404 + JSON (bukan HTML) — semua nilai ini valid.
check "API /api/coupons/validate" "HTTP $C (route hidup)" "$([ "$C" = "400" ] || [ "$C" = "404" ] || [ "$C" = "200" ] && echo 1 || echo 0)"

# ── 4. API butuh auth: harus 401 tanpa token (route ter-mount) ──
for ep in balance orders "balance/checkin/status" "admin/users" "admin/stats" "balance/history"; do
  A=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/$ep")
  check "API /api/$ep tanpa token" "HTTP $A" "$([ "$A" = "401" ] && echo 1 || echo 0)"
done

echo ""
if [ "$FAIL" = "0" ]; then
  ok "SEMUA VERIFIKASI LULUS ($PASS cek)"
else
  err "VERIFIKASI GAGAL: $FAIL cek — review di atas."
  exit 1
fi

echo "✅ Selesai — https://upbit.my.id ($URL)"
