#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Pizzaria do Rocha — Criar VM e2-micro Always Free via gcloud CLI
# ─────────────────────────────────────────────────────────────
# Uso: bash vps/create-instance-gcloud.sh [ID_DO_PROJETO] [ZONA]
# Exemplo: bash vps/create-instance-gcloud.sh meu-projeto-gcp us-central1-a
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="${1:-${PROJECT_ID:-}}"
ZONE="${2:-us-central1-a}"
INSTANCE="pizza-online"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STARTUP_FILE="$SCRIPT_DIR/cloud-init-vps.yaml"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "❌ Google Cloud SDK (gcloud) não está instalado ou não está no PATH."
  echo "👉 Instale em: https://cloud.google.com/sdk/docs/install ou use o Google Cloud Shell."
  exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
fi

if [[ -z "$PROJECT_ID" || "$PROJECT_ID" == "(unset)" ]]; then
  echo "❌ Nenhum projeto do GCP selecionado."
  echo "👉 Defina o projeto executando: gcloud config set project SEU_PROJECT_ID"
  exit 1
fi

echo "== [1/5] Selecionando projeto: $PROJECT_ID =="
gcloud config set project "$PROJECT_ID"

echo "== [2/5] Ativando a API Compute Engine (pode levar 1-2 min) =="
gcloud services enable compute.googleapis.com

echo "== [3/5] Criando regra de firewall (HTTP 80 / HTTPS 443) =="
if gcloud compute firewall-rules describe pizza-online-web >/dev/null 2>&1; then
  echo "  ℹ️ Regra de firewall pizza-online-web já existe."
else
  gcloud compute firewall-rules create pizza-online-web \
    --allow=tcp:80,tcp:443 \
    --target-tags=pizza-online \
    --description="Permite tráfego HTTP e HTTPS para a Pizzaria"
fi

echo "== [4/5] Criando a VM Always Free ($INSTANCE em $ZONE) =="
if gcloud compute instances describe "$INSTANCE" --zone="$ZONE" >/dev/null 2>&1; then
  echo "  ℹ️ A VM $INSTANCE já existe na zona $ZONE."
else
  gcloud compute instances create "$INSTANCE" \
    --zone="$ZONE" \
    --machine-type=e2-micro \
    --tags=pizza-online \
    --image-family=debian-12 \
    --image-project=debian-cloud \
    --boot-disk-size=30GB \
    --boot-disk-type=pd-standard \
    --metadata-from-file=startup-script="$STARTUP_FILE"
fi

echo "== [5/5] Obtendo o IP Externo da VM =="
IP="$(gcloud compute instances describe "$INSTANCE" --zone="$ZONE" --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"

echo ""
echo "============================================================="
echo "🎉 VM criada com sucesso no Google Cloud!"
echo "📍 Instância: $INSTANCE"
echo "🌐 IP Externo: $IP"
echo "============================================================="
echo ""
echo "👉 Próximo passo (fazer o upload do projeto para a VPS):"
echo "   bash vps/upload.sh $IP"
echo ""
