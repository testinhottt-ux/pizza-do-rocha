#!/usr/bin/env bash
# Cria uma VM e2-micro usando Compute Engine REST API.
# Pré-requisitos: PROJECT_ID definido, billing/API Compute habilitados,
# token OAuth (gcloud auth print-access-token ou ACCESS_TOKEN).
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-}"
ZONE="${ZONE:-us-central1-a}"
INSTANCE="${INSTANCE:-pizza-online}"
TOKEN="${ACCESS_TOKEN:-}"
ROOT="https://compute.googleapis.com/compute/v1/projects/${PROJECT_ID}"

die() { printf 'ERRO: %s\n' "$*" >&2; exit 1; }

[[ -n "$PROJECT_ID" ]] || die 'defina PROJECT_ID=seu-projeto'
command -v curl >/dev/null || die 'curl não instalado'
command -v jq >/dev/null || die 'jq não instalado'

if [[ -z "$TOKEN" ]] && command -v gcloud >/dev/null; then
  TOKEN="$(gcloud auth print-access-token)"
fi
[[ -n "$TOKEN" ]] || die 'defina ACCESS_TOKEN ou instale/autentique o gcloud'

STARTUP_FILE="${STARTUP_FILE:-$(dirname "$0")/cloud-init-vps.yaml}"
[[ -r "$STARTUP_FILE" ]] || die "startup script não encontrado: $STARTUP_FILE"

api() {
  local method="$1" url="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl --fail-with-body -sS -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' -d "$body"
  else
    curl --fail-with-body -sS -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

echo "Criando regra HTTP/HTTPS (se já existir, continua)..."
FIREWALL_BODY="$(jq -n '{name:"pizza-online-web",network:"global/networks/default",targetTags:["pizza-online"],sourceRanges:["0.0.0.0/0"],allowed:[{IPProtocol:"tcp",ports:["80","443"]}] }')"
if ! api POST "$ROOT/global/firewalls" "$FIREWALL_BODY" >/dev/null 2>&1; then
  echo 'Aviso: regra já existente ou sem permissão; verifique o firewall manualmente.'
fi

STARTUP="$(<"$STARTUP_FILE")"
BODY="$(jq -n \
  --arg name "$INSTANCE" \
  --arg zone "${ZONE}" \
  --arg startup "$STARTUP" \
  '{name:$name,
    machineType:("zones/"+$zone+"/machineTypes/e2-micro"),
    tags:{items:["pizza-online"]},
    disks:[{boot:true,autoDelete:true,type:"PERSISTENT",
      initializeParams:{diskSizeGb:"30",diskType:("zones/"+$zone+"/diskTypes/pd-standard"),
        sourceImage:"projects/debian-cloud/global/images/family/debian-12"}}],
    networkInterfaces:[{network:"global/networks/default",accessConfigs:[{name:"External NAT",type:"ONE_TO_ONE_NAT"}]}],
    metadata:{items:[{key:"startup-script",value:$startup}]},
    scheduling:{automaticRestart:true,onHostMaintenance:"MIGRATE"}}')"

echo "Criando $INSTANCE em $ZONE..."
RESULT="$(api POST "$ROOT/zones/$ZONE/instances" "$BODY")"
echo "$RESULT" | jq '{operation: .name, status: .status, selfLink: .selfLink}'
echo 'Aguarde a operação terminar; depois consulte o IP externo no Compute Engine.'
