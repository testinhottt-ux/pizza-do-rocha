#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Pizzaria do Rocha — Deploy para VPS Google Cloud (e2-micro)
# ─────────────────────────────────────────────────────────────
# COMO USAR:
#   1. Crie a VM no console Google (coloque o cloud-init-vps.yaml na aba "Automação")
#   2. Anote o IP externo da VM
#   3. Rode daqui:  ./vps/upload.sh IP_DO_VPS
# ─────────────────────────────────────────────────────────────
set -euo pipefail

IP="${1:-}"
if [[ -z "$IP" ]]; then
  echo "❌ Uso: bash vps/upload.sh <IP_DO_VPS>"
  exit 1
fi

USUARIO="${2:-${USUARIO:-root}}"
DEST="/opt/app"
PASTA=/home/teste/pizza

echo "== [1/4] Validando conexão SSH ($USUARIO@$IP) =="
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$USUARIO@$IP" 'echo SSH OK' \
  || { echo "❌ Não consegui conectar. Confira o IP, o usuário ($USUARIO) e abra SSH no firewall GCP."; exit 1; }

echo "== [2/4] Enviando código do projeto (node_modules ignorado) =="
tar cf - \
  index.html styles.css awards.css store.js ui.js support.js \
  server.mjs infinitepay-client.mjs whatsapp-web.mjs server-config.json \
  package.json package-lock.json images \
  2>/dev/null \
  | ssh "$USUARIO@$IP" "mkdir -p $DEST && tar xf - -C $DEST"

echo "== [3/4] Instalando dependências no VPS =="
ssh "$USUARIO@$IP" "cd $DEST && npm install --omit=dev"

echo "== [4/4] Subindo servidor com pm2 =="
ssh "$USUARIO@$IP" "cd $DEST && npx pm2 delete pizzaria 2>/dev/null || true; npx pm2 start server.mjs --name pizzaria; npx pm2 save"

echo ""
echo "✅ DEPLOY CONCLUÍDO!"
echo "🌐 Acesse: http://$IP"
echo "🔒 Primeira troca de senha (opcional): ssh $USUARIO@$IP 'passwd'"