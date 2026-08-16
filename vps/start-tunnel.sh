#!/usr/bin/env bash
# Sobe o tunnel Cloudflare (trycloudflare) apontando para o servidor local.
# Uso: ./vps/start-tunnel.sh [porta]   (padrao 3000)
# A URL publica fica salva em LOGS/tunnel-url.txt
set -uo pipefail

PORTA="${1:-3000}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$RAIZ/LOGS/tunnel.log"
URL_FILE="$RAIZ/LOGS/tunnel-url.txt"
INICIO=$(date +%s)

mkdir -p "$RAIZ/LOGS"
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 2
: > "$LOG"
rm -f "$URL_FILE"

# setsid + fds fechados = processo sobrevive ao encerramento do shell pai
setsid cloudflared tunnel --url "http://127.0.0.1:${PORTA}" --no-autoupdate \
  >"$LOG" 2>&1 </dev/null &
disown 2>/dev/null || true

# Aguarda a URL publica aparecer no log (ate 40s)
for _ in $(seq 1 40); do
  URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOG" 2>/dev/null | head -1)
  if [ -n "${URL:-}" ]; then
    echo "$URL" > "$URL_FILE"
    echo "OK  url=$URL  porta=$PORTA  tempo=$(( $(date +%s) - INICIO ))s"
    exit 0
  fi
  sleep 1
done

echo "FALHA: URL nao apareceu em 40s. Ultimas linhas do log:"
tail -5 "$LOG"
exit 1
