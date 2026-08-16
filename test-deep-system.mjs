// test-deep-system.mjs — Teste Completo e Automatizado de Ponta a Ponta:
// 1. Aplicação e Vitrine
// 2. Segurança e Hardening
// 3. Pagamento InfinitePay (PIX / Cartão / Webhook / Simulação)
// 4. WhatsApp Web (Baileys, Pareamento, Notificações, Histórico)
// 5. Gestão de Pedidos e Admin

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

console.log('🍕 INICIANDO SUÍTE DE TESTES PROFUNDOS DO SISTEMA PIZZARIA DO ROCHA\n');

const PORT = 3988;
const BASE = `http://localhost:${PORT}`;

async function req(method, path, body, headers = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
}

const tests = [];
function test(name, pass, detail = '') {
  tests.push({ name, pass, detail });
  console.log((pass ? '  ✅ PASS: ' : '  ❌ FAIL: ') + name + (detail ? ' (' + detail + ')' : ''));
}

const srv = spawn('node', ['server.mjs', String(PORT)], { stdio: 'pipe', cwd: process.cwd() });
let stderr = '';
srv.stderr.on('data', d => stderr += d);

await sleep(1500);

try {
  // ── 1. FRONTEND E ESTÁTICOS ──
  console.log('\n[1/5] Testando Aplicação, Frontend e Arquivos Estáticos...');
  const rIndex = await fetch(BASE + '/');
  test('index.html servido com HTTP 200', rIndex.status === 200);

  const rAd = await fetch(BASE + '/ad');
  test('/ad entrega aplicação de forma transparente', rAd.status === 200);

  const rCss = await fetch(BASE + '/styles.css');
  test('styles.css servido', rCss.status === 200);

  const rAwards = await fetch(BASE + '/awards.css');
  test('awards.css servido', rAwards.status === 200);

  const rStore = await fetch(BASE + '/store.js');
  test('store.js servido', rStore.status === 200);

  const rUi = await fetch(BASE + '/ui.js');
  test('ui.js servido', rUi.status === 200);

  const rManifest = await fetch(BASE + '/manifest.json');
  test('manifest.json PWA servido', rManifest.status === 200);

  const rImg = await fetch(BASE + '/images/pizza-margherita.jpg');
  test('Imagens do cardápio servidas corretamente', rImg.status === 200);

  // ── 2. SEGURANÇA E HARDENING (MDCA EIXO 5) ──
  console.log('\n[2/5] Testando Blindagem e Segurança HTTP...');
  const rSec1 = await fetch(BASE + '/server-config.json');
  test('server-config.json bloqueado (HTTP 403)', rSec1.status === 403);

  const rSec2 = await fetch(BASE + '/LOGS/.admin-password');
  test('Credencial de admin protegida contra download HTTP (HTTP 403)', rSec2.status === 403);

  const rSec3 = await fetch(BASE + '/ag3.md');
  test('ag3.md protegido contra acesso externo (HTTP 403)', rSec3.status === 403);

  const rSec4 = await fetch(BASE + '/server.mjs');
  test('Código fonte server.mjs protegido contra download (HTTP 403)', rSec4.status === 403);

  const rSec5 = await fetch(BASE + '/package.json');
  test('package.json protegido contra download (HTTP 403)', rSec5.status === 403);

  // ── 3. INTEGRAÇÃO OFICIAL INFINITEPAY ──
  console.log('\n[3/5] Testando Integração Oficial InfinitePay...');
  // Configuração
  const saveCfg = await req('POST', '/api/config', {
    infinitePayHandle: 'pizzariadorocha',
    modoSimulacao: true,
    modoLanding: false,
    whatsapp: '5531999887766'
  });
  test('POST /api/config salva handle InfinitePay e parâmetros', saveCfg.status === 200 && saveCfg.body?.infinitePayHandle === 'pizzariadorocha');

  const getCfg = await req('GET', '/api/config');
  test('GET /api/config retorna handle e estado de configuração', getCfg.status === 200 && getCfg.body?.infinitePayConfigured === true);

  const testConn = await req('POST', '/api/testar-conexao');
  test('POST /api/testar-conexao valida a integração InfinitePay', testConn.status === 200 && testConn.body?.valid === true);

  // Cobrança PIX
  const pixOrder = await req('POST', '/api/pagamento', {
    nome: 'Ana Oliveira',
    cpfCnpj: '12345678901',
    telefone: '5531988887777',
    endereco: 'Rua das Pizzas, 100',
    valor: 89.90,
    metodo: 'pix',
    descricao: '1x Pizza Calabresa + 1x Coca-Cola'
  });
  test('POST /api/pagamento gera cobrança PIX com sucesso', pixOrder.status === 200 && pixOrder.body?.sucesso === true && pixOrder.body?.metodo === 'pix');

  // Cobrança Cartão de Crédito
  const cardOrder = await req('POST', '/api/pagamento', {
    nome: 'Roberto Silva',
    cpfCnpj: '98765432100',
    telefone: '5531977778888',
    endereco: 'Av Central, 200',
    valor: 135.00,
    metodo: 'cartao',
    descricao: '2x Pizza Quatro Queijos'
  });
  test('POST /api/pagamento gera checkout de Cartão com sucesso', cardOrder.status === 200 && cardOrder.body?.sucesso === true && cardOrder.body?.metodo === 'cartao');

  // Simulação / Confirmação de Pagamento
  if (pixOrder.body?.paymentId) {
    const simPix = await req('POST', `/api/pagamento/${pixOrder.body.paymentId}/simular`, {
      externalReference: pixOrder.body.externalReference
    });
    test('POST /api/pagamento/:id/simular confirma cobrança e aciona mensageria', simPix.status === 200 && simPix.body?.status === 'CONFIRMED');
  }

  // Webhook Oficial InfinitePay
  const webhookRes = await req('POST', '/api/webhook-infinitepay', {
    order_nsu: 'ped_webhook_test_999',
    transaction_nsu: 'trans_inf_999',
    slug: 'slug_infinite_999',
    amount: 8990,
    capture_method: 'pix',
    receipt_url: 'https://www.infinitepay.io/comprovante/999'
  });
  test('POST /api/webhook-infinitepay recebe e valida confirmação oficial', webhookRes.status === 200 && webhookRes.body?.received === true);

  // ── 4. GESTÃO DE PEDIDOS NO BACKEND ──
  console.log('\n[4/5] Testando Gestão de Pedidos e Painel do Dono...');
  const novoPed = await req('POST', '/api/pedidos', {
    cliente: {
      nome: 'Carlos Dono Teste',
      telefone: '5531999990000',
      endereco: 'Rua A, 50',
      cpf: '12345678901'
    },
    itens: [
      { nome: 'Pizza Margherita', qtd: 2, preco: 45.00 },
      { nome: 'Refrigerante 2L', qtd: 1, preco: 12.00 }
    ],
    metodo: 'pix'
  });
  const pedId = novoPed.body?.pedido?.id;
  test('POST /api/pedidos cria pedido e calcula total (R$ 102.00)', novoPed.status === 201 && novoPed.body?.pedido?.total === 102);
  test('CPF do cliente é mascarado automaticamente', /^\*{3}\.\*{3}\.\*{2}\d{3}$/.test(novoPed.body?.pedido?.cliente?.cpf || ''));

  // Autenticação Admin de Pedidos
  const listAdmin = await req('GET', '/api/pedidos', null, { 'x-admin-pass': 'pizzadorochaboademais' });
  test('GET /api/pedidos com senha correta lista todos os pedidos', listAdmin.status === 200 && listAdmin.body?.pedidos?.length > 0);

  const listSemSenha = await req('GET', '/api/pedidos');
  test('GET /api/pedidos sem senha bloqueia acesso com HTTP 401', listSemSenha.status === 401);

  // Avanço de status de pedido
  const statusAdv = await req('POST', `/api/pedidos/${pedId}/status`, { status: 'preparando' }, { 'x-admin-pass': 'pizzadorochaboademais' });
  test('POST /api/pedidos/:id/status avança status para "preparando"', statusAdv.status === 200 && statusAdv.body?.pedido?.status === 'preparando');

  // Acompanhamento do pedido pelo cliente
  const consultaCli = await req('GET', `/api/pedidos/${pedId}`);
  test('GET /api/pedidos/:id permite cliente acompanhar status ("preparando")', consultaCli.status === 200 && consultaCli.body?.pedido?.status === 'preparando');
  test('GET /api/pedidos/:id consulta pública não expõe endereço', consultaCli.body?.pedido?.cliente === undefined);

  // ── 5. NOTIFICAÇÕES WHATSAPP WEB (BAILEYS) ──
  console.log('\n[5/5] Testando Notificações e Módulo WhatsApp Web (Baileys)...');
  const waStatus = await req('GET', '/api/whatsapp/status');
  test('GET /api/whatsapp/status retorna estado do bot', waStatus.status === 200 && typeof waStatus.body?.ativo === 'boolean');

  const waPairInvalid = await req('POST', '/api/whatsapp/parear', { numero: '123' });
  test('POST /api/whatsapp/parear rejeita formato inválido de telefone', waPairInvalid.status === 400);

  const waHist = await req('GET', '/api/whatsapp/mensagens?limite=10');
  test('GET /api/whatsapp/mensagens lista histórico de notificações disparadas', waHist.status === 200 && Array.isArray(waHist.body?.mensagens));

  const waSendUnpaired = await req('POST', '/api/whatsapp/enviar', {
    numero: '5531999990000',
    texto: '🍕 Notificação de teste'
  });
  test('POST /api/whatsapp/enviar responde com código 409 quando não pareado', waSendUnpaired.status === 409 && waSendUnpaired.body?.notPaired === true);

} catch(err) {
  console.error('❌ EXCEÇÃO DURANTE OS TESTES:', err);
} finally {
  srv.kill();
}

const passCount = tests.filter(t => t.pass).length;
const failCount = tests.filter(t => !t.pass).length;
console.log('\n=============================================================');
console.log(`RESULTADO FINAL DO TESTE: ${passCount}/${tests.length} PASSARAM (${failCount} FALHAS)`);
console.log('=============================================================\n');

if (failCount > 0) process.exit(1);
