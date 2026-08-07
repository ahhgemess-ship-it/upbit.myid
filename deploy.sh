#!/usr/bin/env bash
#
# deploy.sh — Deploy otomatis one-shot untuk upbit-store ke Vercel
#
# Pipeline: push git → deploy Vercel → verify
#
# Pemakaian:
#   ./deploy.sh                        # push + deploy + verify
#   VERCEL_TOKEN=xxx ./deploy.sh       # pakai token Vercel (default: dari env)
#
set -euo pipefail

# ---------- Konfigurasi ----------
DOMAIN="upbit.my.id"
TOKEN="${VERCEL_TOKEN}"
ALIAS_URL="upbit-store-vert.vercel.app"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()  { echo -e "${GREEN}✔${NC} $1"; }
warn(){ echo -e "${YELLOW}!${NC} $1"; }
err() { echo -e "${RED}✘${NC} $1"; }

cd "$(dirname "${BASH_SOURCE[0]}")"

echo "▶ [1/3] Push ke GitHub..."
GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519_upbit -o IdentitiesOnly=yes' git push 2>&1 | tail -1
ok "Push OK"

echo "▶ [2/3] Deploy ke Vercel production..."
URL=$(vercel --yes --prod --token "$TOKEN" 2>&1 | grep -oP 'https://[a-zA-Z0-9-]+\.vercel\.app' | head -1)
if [ -z "$URL" ]; then
  err "Deploy gagal — tidak dapat URL"
  exit 1
fi
ok "Deploy: $URL"

echo "▶ [3/3] Verifikasi ($ALIAS_URL)..."
sleep 10

PASS=0; FAIL=0
check() {
  if [ "$3" = "1" ]; then ok "  $1 — $2"; PASS=$((PASS + 1)); else err "  $1 — $2"; FAIL=$((FAIL + 1)); fi
}

# Frontend
FRONT=$(curl -s -o /dev/null -w '%{http_code}' "https://$ALIAS_URL/")
check "Frontend /" "HTTP $FRONT" "$([ "$FRONT" = "200" ] && echo 1 || echo 0)"

# API
H=$(curl -s "https://$ALIAS_URL/api/health")
check "API /api/health" "$H" "$(echo "$H" | grep -q '"ok":true' && echo 1 || echo 0)"

P=$(curl -s -o /dev/null -w '%{http_code}' "https://$ALIAS_URL/api/products")
check "API /api/products" "HTTP $P" "$([ "$P" = "200" ] && echo 1 || echo 0)"

echo ""
if [ "$FAIL" = "0" ]; then
  ok "SEMUA VERIFIKASI LULUS ($PASS cek)"
  echo "✅ Live: https://$ALIAS_URL"
  echo "📝 Domain: https://$DOMAIN (perlu dilepas dari akun lama dulu)"
else
  err "VERIFIKASI GAGAL: $FAIL cek"
  exit 1
fi
