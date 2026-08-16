# Status: Migração de pagamentos para InfinitePay

- Gate 1 — Product: APPROVED 2026-08-09
- Gate 2 — Architecture: implementado junto às slices
- Gate 3 — Program Design: implementado junto às slices
- Gate 4 — Slice plan: em execução

## Slices
- [x] Slice 1 — fluxo de checkout de teste com confirmação simulada
- [x] Slice 2 — criação de link InfinitePay via API oficial
- [x] Slice 3 — webhook InfinitePay recebido e registrado
- [x] Slice 4 — remoção completa do Asaas e das credenciais expostas
- [ ] Slice 5 — deploy e teste online no Google Cloud (bloqueado: billing)

## Estado atual
- Backend agora usa `infinitepay-client.mjs` com `POST https://api.checkout.infinitepay.io/links`.
- Rotas: `POST /api/pagamento`, `GET /api/pagamento/:id`, `POST /api/webhook-infinitepay`.
- Credenciais via variáveis de ambiente: `INFINITEPAY_HANDLE`, `INFINITEPAY_REDIRECT_URL`, `INFINITEPAY_WEBHOOK_URL`.
- Arquivos Asaas removidos: `api-asaas.mjs`, `asaas-config.js`, `apiassas`, testes e guia.
- Testes locais: `npm test` 7/7 e `node test-server.mjs` todos verdes.

## Pendências críticas
- Chaves Asaas que estavam versionadas devem ser revogadas no painel Asaas.
- Não há persistência server-side de pedidos; webhook ainda não confirma pedido automaticamente.
- Deploy online exige billing ativo no projeto `gen-lang-client-0862641257`.
