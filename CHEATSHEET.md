# 🚀 CHEATSHEET — Guia Rápido de Comandos

**Pizzaria do Rocha** — Integração oficial InfinitePay & WhatsApp Web (Baileys)

---

## 🧪 TESTES

### Executar Suíte Completa de Testes
```bash
npm test
# ou
node test-all.mjs
```

### Executar Teste de Integração do Servidor (APIs / Pagamentos)
```bash
node test-server.mjs
```

---

## 🚀 EXECUÇÃO

### Iniciar Servidor em Desenvolvimento
```bash
npm run dev
# Sobe em http://localhost:3000
```

### Iniciar Servidor em Produção
```bash
npm start
```

---

## 💳 PAGAMENTOS (INFINITEPAY)

- **Módulo**: `infinitepay-client.mjs`
- **Backend API**: `/api/pagamento`, `/api/pagamento/:id`, `/api/webhook-infinitepay`
- **Variáveis de Ambiente**:
  - `INFINITEPAY_HANDLE`: Handle da conta InfinitePay (ex.: `$seunome` ou `seunome`)
  - `INFINITEPAY_REDIRECT_URL`: URL de retorno pós-pagamento
  - `INFINITEPAY_WEBHOOK_URL`: URL do webhook para confirmação
- **Modos**:
  - Simulação ativa por padrão para testes sem cobrança real.
  - Modo Produção com checkout oficial InfinitePay.

---

## 📱 WHATSAPP

- **Módulo**: `whatsapp-web.mjs` (Baileys)
- **Status**: `/api/whatsapp/status`
- **QR Code**: `/api/whatsapp/qrcode` e `/api/whatsapp/qrcode/png`
- **Pareamento por Código**: `POST /api/whatsapp/parear`
- **Notificação de novos pedidos e comprovantes automáticos**.
