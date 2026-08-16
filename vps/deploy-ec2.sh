#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Pizzaria do Rocha — Deploy para AWS EC2 Free Tier
# Uso:
#   ./vps/deploy-ec2.sh <IP_PUBLICO_EC2> <CAMINHO_CHAVE_PEM> [USUARIO]
# Exemplo:
#   ./vps/deploy-ec2.sh 54.232.100.50 ~/.ssh/minha-chave.pem ubuntu
# ─────────────────────────────────────────────────────────────
set -euo pipefail

IP="${1:-}"
KEY="${2:-}"
USUARIO="${3:-ubuntu}"
DEST="/opt/app"

if [[ -z "$IP" || -z "$KEY" ]]; then
  echo "❌ Uso: bash vps/deploy-ec2.sh <IP_PUBLICO_EC2> <CAMINHO_CHAVE_PEM> [USUARIO (padrão: ubuntu)]"
  echo "Exemplo: bash vps/deploy-ec2.sh 54.232.100.50 ~/Downloads/chave.pem"
  exit 1
fi

if [[ ! -f "$KEY" ]]; then
  echo "❌ Arquivo de chave SSH não encontrado em: $KEY"
  exit 1
fi

chmod 400 "$KEY"

echo "== [1/4] Testando conexão SSH com EC2 ($USUARIO@$IP) =="
ssh -i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15 "$USUARIO@$IP" 'echo "Conexão SSH OK!"' \
  || { echo "❌ Falha ao conectar via SSH. Verifique o IP, a chave .pem e o Security Group (porta 22 aberta)."; exit 1; }

echo "== [2/4] Enviando arquivos da aplicação =="
ssh -i "$KEY" "$USUARIO@$IP" "sudo mkdir -p $DEST && sudo chown -R $USUARIO:$USUARIO $DEST"

tar cf - \
  index.html styles.css awards.css store.js ui.js support.js \
  server.mjs infinitepay-client.mjs whatsapp-web.mjs server-config.json \
  package.json package-lock.json images uploads 2>/dev/null \
  | ssh -i "$KEY" "$USUARIO@$IP" "tar xf - -C $DEST"

echo "== [3/4] Instalando dependências (npm install) =="
ssh -i "$KEY" "$USUARIO@$IP" "cd $DEST && npm install --omit=dev"

echo "== [4/4] Iniciando / Reiniciando com PM2 =="
ssh -i "$KEY" "$USUARIO@$IP" "cd $DEST && pm2 delete pizzaria 2>/dev/null || true && pm2 start server.mjs --name pizzaria && pm2 save"

echo ""
echo "=========================================================="
echo "✅ DEPLOY NO AWS EC2 CONCLUÍDO COM SUCESSO!"
echo "🌐 Acesse no seu navegador: http://$IP"
echo "=========================================================="
