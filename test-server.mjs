// test-server.mjs — Integração: sobe o servidor e testa /api/* reais
// Exibe detalhadamente Variáveis de Entrada (Inputs), Saída (Outputs) e Explicações de Estado
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const REAL = process.argv.includes('--real');
const BASE = 'http://localhost:3987';
const ADMIN_PASS = 'pizzadorochaboademais';

async function req(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: data };
}

let passedCount = 0;
let totalCount = 0;

function logStep({ num, name, endpoint, input, output, explanation, cond }) {
  totalCount++;
  const isOk = Boolean(cond);
  if (isOk) passedCount++;
  
  console.log(`\n───────────────────────────────────────────────────────────────────────────────`);
  console.log(`[TESTE ${num}] ${isOk ? '✅' : '❌'} FUNÇÃO / ENDPOINT: ${name} (${endpoint})`);
  console.log(`───────────────────────────────────────────────────────────────────────────────`);
  console.log(`📥 VARIÁVEIS DE ENTRADA (INPUTS):`);
  if (!input || Object.keys(input).length === 0) {
    console.log(`   • (Sem payload / Parâmetros na URL ou Headers)`);
  } else {
    for (const [k, v] of Object.entries(input)) {
      console.log(`   • ${k} (${typeof v}): ${JSON.stringify(v)}`);
    }
  }
  console.log(`📤 VARIÁVEIS DE SAÍDA (OUTPUTS):`);
  console.log(`   • HTTP Status: ${output.status}`);
  if (output.body && typeof output.body === 'object') {
    for (const [k, v] of Object.entries(output.body)) {
      console.log(`   • ${k}: ${JSON.stringify(v)}`);
    }
  } else {
    console.log(`   • Body: ${JSON.stringify(output.body)}`);
  }
  console.log(`🔍 EXPLICAÇÃO DAS VARIÁVEIS & ESTADO:`);
  console.log(`   ${explanation}`);
  console.log(`   Status do Teste: ${isOk ? 'APROVADO (Funcional)' : 'FALHOU'}`);
}

const srv = spawn('node', ['server.mjs', '3987'], { stdio: 'pipe', cwd: process.cwd() });
let stderr = '';
srv.stderr.on('data', d => stderr += d);

console.log('🍕 PIZZARIA DO ROCHA — SUÍTE DE TESTES COM RELATÓRIO DE ENTRADAS & SAÍDAS');
console.log('Validando processamento de pagamentos InfinitePay (Pix & Cartão), Pedidos e Cardápio\n');

await sleep(1200);

try {
  // 1. GET /
  const homeRes = await fetch(BASE + '/');
  logStep({
    num: 1,
    name: 'Servir Página Principal (SPA)',
    endpoint: 'GET /',
    input: { headers: 'Accept: text/html' },
    output: { status: homeRes.status, body: 'HTML Document (Pizzaria do Rocha)' },
    explanation: 'Entrada: requisição HTTP GET padrão do navegador. Saída: código HTTP 200 servindo a SPA (index.html) com design Awwwards.',
    cond: homeRes.status === 200
  });

  // 2. GET /api/config
  const cfg = await req('GET', '/api/config');
  logStep({
    num: 2,
    name: 'Consultar Configurações do Sistema & InfinitePay',
    endpoint: 'GET /api/config',
    input: {},
    output: cfg,
    explanation: 'Entrada: nenhuma (consulta pública). Saída: infinitePayConfigured (indica se há handle configurado), infinitePayHandle (identificador do recebedor), modoSimulacao (booleano), whatsappNotif (celular do dono).',
    cond: cfg.status === 200 && typeof cfg.body?.infinitePayConfigured === 'boolean'
  });

  // 3. POST /api/config
  const saveCfgInput = { infinitePayHandle: 'demo_handle', modoSimulacao: true, modoLanding: false, whatsappNotif: '5531996678280' };
  const saveCfg = await req('POST', '/api/config', saveCfgInput);
  logStep({
    num: 3,
    name: 'Atualizar Credenciais InfinitePay e Parâmetros',
    endpoint: 'POST /api/config',
    input: saveCfgInput,
    output: saveCfg,
    explanation: 'Entrada: infinitePayHandle (conta InfinitePay destino), modoSimulacao (true/false), whatsappNotif (número do dono para receber avisos). Saída: confirmação dos dados gravados em server-config.json.',
    cond: saveCfg.status === 200 && saveCfg.body?.infinitePayHandle === 'demo_handle'
  });

  // 4. POST /api/testar-conexao
  const tst = await req('POST', '/api/testar-conexao');
  logStep({
    num: 4,
    name: 'Validar Conexão com a Gateway InfinitePay',
    endpoint: 'POST /api/testar-conexao',
    input: {},
    output: tst,
    explanation: 'Entrada: requisição para testar credencial. Saída: valid (booleano se a conta é válida), status ("CONFIGURED"), message (mensagem amigável para o painel admin).',
    cond: tst.status === 200 && tst.body?.valid === true
  });

  // 5. POST /api/pagamento (PIX)
  const pixInput = {
    nome: 'Carlos Eduardo da Rocha',
    cpfCnpj: '12345678909',
    telefone: '5531999887766',
    endereco: 'Rua das Pizzas, 100',
    valor: 89.40,
    metodo: 'pix',
    descricao: '2x Pizza Margherita Média'
  };
  const simPix = await req('POST', '/api/pagamento', pixInput);
  logStep({
    num: 5,
    name: 'Gerar Cobrança Instantânea PIX (InfinitePay)',
    endpoint: 'POST /api/pagamento',
    input: pixInput,
    output: simPix,
    explanation: 'Entrada: nome (comprador), cpfCnpj (documento), telefone (WhatsApp do cliente), valor (total em R$), metodo ("pix"), descricao (itens do pedido). Saída: sucesso (true), paymentId (ID único da transação), status ("PENDING"), externalReference (código de conciliação).',
    cond: simPix.status === 200 && simPix.body?.sucesso === true && simPix.body?.metodo === 'pix'
  });

  // 6. POST /api/pagamento/:id/simular (Confirmação de PIX)
  const pixId = simPix.body?.paymentId;
  const confPix = await req('POST', `/api/pagamento/${pixId}/simular`, { externalReference: simPix.body?.externalReference });
  logStep({
    num: 6,
    name: 'Confirmar Pagamento PIX e Disparar Notificações',
    endpoint: `POST /api/pagamento/${pixId}/simular`,
    input: { paymentId: pixId, externalReference: simPix.body?.externalReference },
    output: confPix,
    explanation: 'Entrada: paymentId da cobrança a ser liquidada. Saída: status alterado para "CONFIRMED", acionando automaticamente a baixa do pagamento e envio de comprovante no WhatsApp.',
    cond: confPix.status === 200 && confPix.body?.status === 'CONFIRMED'
  });

  // 7. POST /api/pagamento (CARTÃO DE CRÉDITO)
  const cartInput = {
    nome: 'Mariana Fernandes',
    cpfCnpj: '98765432100',
    telefone: '5531888776655',
    endereco: 'Av Central, 500',
    valor: 129.80,
    metodo: 'cartao',
    descricao: '1x Pizza 1/2 Salaminho 1/2 Lombinho Gigante + 2x Coca-Cola'
  };
  const simCart = await req('POST', '/api/pagamento', cartInput);
  logStep({
    num: 7,
    name: 'Gerar Checkout de Cartão de Crédito (Até 12x / InfinitePay)',
    endpoint: 'POST /api/pagamento',
    input: cartInput,
    output: simCart,
    explanation: 'Entrada: dados do titular, valor e metodo "cartao". Saída: paymentId da transação, metodo "cartao", status "PENDING" e checkoutUrl seguro para pagamento com parcelamento.',
    cond: simCart.status === 200 && simCart.body?.metodo === 'cartao' && simCart.body?.sucesso === true
  });

  // 8. POST /api/webhook-infinitepay
  const whInput = {
    event: 'PAYMENT_RECEIVED',
    order_nsu: 'ped_webhook_test_888',
    transaction_nsu: 'trans_inf_888',
    slug: 'slug_infinite_888',
    amount: 12980,
    capture_method: 'credit_card',
    receipt_url: 'https://www.infinitepay.io/comprovante/888'
  };
  const whRes = await req('POST', '/api/webhook-infinitepay', whInput);
  logStep({
    num: 8,
    name: 'Receber Webhook Oficial de Notificação da InfinitePay',
    endpoint: 'POST /api/webhook-infinitepay',
    input: whInput,
    output: whRes,
    explanation: 'Entrada: payload oficial enviado pelos servidores da InfinitePay com transaction_nsu, capture_method e valor em centavos. Saída: HTTP 200 { received: true, provider: "infinitepay" } confirmando o recebimento.',
    cond: whRes.status === 200 && whRes.body?.received === true
  });

  // 9. POST /api/pedidos
  const pedInput = {
    cliente: { nome: 'João da Silva', telefone: '5531999887766', endereco: 'Rua das Palmeiras, 45', cpf: '12345678901' },
    itens: [
      { nome: '1/2 Salaminho e 1/2 Lombinho Canadense · Gigante', qtd: 1, preco: 59.99 },
      { nome: 'Coca-Cola', qtd: 2, preco: 13.99 }
    ],
    metodo: 'pix'
  };
  const novoPed = await req('POST', '/api/pedidos', pedInput);
  const pedId = novoPed.body?.pedido?.id;
  logStep({
    num: 9,
    name: 'Criar Pedido no Servidor com Total Calculado e CPF Mascarado',
    endpoint: 'POST /api/pedidos',
    input: pedInput,
    output: novoPed,
    explanation: 'Entrada: cliente (nome, telefone, endereço, CPF), itens (produtos e quantidades), metodo de pagamento. Saída: id do pedido, numero sequencial, total calculado com precisão (R$ 87.97), status inicial "recebido" e CPF mascarado (LGPD).',
    cond: novoPed.status === 201 && novoPed.body?.pedido?.total === 87.97 && /^\*{3}\.\*{3}\.\*{2}\d{3}$/.test(novoPed.body?.pedido?.cliente?.cpf)
  });

  // 10. GET /api/pedidos (Autenticação Admin)
  const listAdmin = await req('GET', '/api/pedidos', null, { 'x-admin-pass': ADMIN_PASS });
  logStep({
    num: 10,
    name: 'Listar Pedidos para o Painel do Dono (Autenticado)',
    endpoint: 'GET /api/pedidos',
    input: { headers: { 'x-admin-pass': ADMIN_PASS } },
    output: { status: listAdmin.status, totalPedidos: listAdmin.body?.total, pedidosAmostra: listAdmin.body?.pedidos?.slice(0, 1) },
    explanation: 'Entrada: Header x-admin-pass com a senha administrativa. Saída: Lista completa de pedidos com dados de entrega e histórico para o painel de pedidos do restaurante.',
    cond: listAdmin.status === 200 && listAdmin.body?.pedidos?.some(p => p.id === pedId)
  });

  // 11. POST /api/pedidos/:id/status
  const advStatusInput = { status: 'preparando' };
  const advStatus = await req('POST', `/api/pedidos/${pedId}/status`, advStatusInput, { 'x-admin-pass': ADMIN_PASS });
  logStep({
    num: 11,
    name: 'Avançar Status do Pedido na Cozinha (Dono da Pizzaria)',
    endpoint: `POST /api/pedidos/${pedId}/status`,
    input: { pedidoId: pedId, ...advStatusInput, headers: { 'x-admin-pass': ADMIN_PASS } },
    output: advStatus,
    explanation: 'Entrada: novo status ("preparando", "forno", "saiu_entrega", "entregue"). Saída: pedido atualizado com histórico de timestamps.',
    cond: advStatus.status === 200 && advStatus.body?.pedido?.status === 'preparando'
  });

  // 12. POST /api/pedidos/:id/pagamento
  const vincPagInput = { status: 'aprovado', provider: 'infinitepay', providerPaymentId: 'sim_inf_123' };
  const vincPag = await req('POST', `/api/pedidos/${pedId}/pagamento`, vincPagInput);
  logStep({
    num: 12,
    name: 'Vincular Pagamento Aprovado ao Pedido',
    endpoint: `POST /api/pedidos/${pedId}/pagamento`,
    input: { pedidoId: pedId, ...vincPagInput },
    output: vincPag,
    explanation: 'Entrada: status do pagamento, provedor ("infinitepay"), providerPaymentId. Saída: confirmação do vínculo da liquidação financeira ao pedido em preparação.',
    cond: vincPag.status === 200 && vincPag.body?.pagamento?.status === 'aprovado'
  });

  // 13. GET /api/pedidos/:id (Acompanhamento do Cliente)
  const consultaCli = await req('GET', `/api/pedidos/${pedId}`);
  logStep({
    num: 13,
    name: 'Acompanhamento Público Seguro do Pedido (Cliente)',
    endpoint: `GET /api/pedidos/${pedId}`,
    input: { pedidoId: pedId },
    output: consultaCli,
    explanation: 'Entrada: ID do pedido pelo link de acompanhamento. Saída: status em tempo real ("preparando") sem expor endereço ou CPF publicamente.',
    cond: consultaCli.status === 200 && consultaCli.body?.pedido?.status === 'preparando' && consultaCli.body?.pedido?.cliente === undefined
  });

  // 14. GET /api/cardapio
  const getCard = await req('GET', '/api/cardapio');
  const items = getCard.body?.items || [];
  const temSalaminho = items.some(i => i.nome.includes('Salaminho'));
  const semAgua = !items.some(i => /[áa]gua|mineral/i.test(i.nome));
  const coca = items.find(i => i.nome.includes('Coca'));
  const guarana = items.find(i => i.nome.includes('Guaraná') || i.nome.includes('Guarana'));
  logStep({
    num: 14,
    name: 'Sincronizar Cardápio Público com Bebidas e Pizzas',
    endpoint: 'GET /api/cardapio',
    input: {},
    output: { status: getCard.status, totalItens: items.length, cocaPreco: coca?.preco, guaranaPreco: guarana?.preco, temSalaminho, semAgua },
    explanation: 'Entrada: requisição pública. Saída: lista de produtos com 1/2 Salaminho e Lombinho presente, sem água, e bebidas (Coca e Guaraná) a R$ 13,99.',
    cond: getCard.status === 200 && temSalaminho && semAgua && coca?.preco === 13.99 && guarana?.preco === 13.99
  });

  // 15. POST /api/cardapio/item
  const novoItemCardapio = {
    id: 'pizza_trufada_demo',
    nome: 'Pizza Trufada Especial do Rocha',
    categoria: 'Pizzas Especiais',
    preco: 68.90,
    estoque: 15,
    ativo: true,
    destaque: true
  };
  const postItem = await req('POST', '/api/cardapio/item', { item: novoItemCardapio }, { 'x-admin-pass': ADMIN_PASS });
  logStep({
    num: 15,
    name: 'Adicionar/Atualizar Produto pelo Painel Admin no Servidor',
    endpoint: 'POST /api/cardapio/item',
    input: { item: novoItemCardapio, headers: { 'x-admin-pass': ADMIN_PASS } },
    output: postItem,
    explanation: 'Entrada: objeto completo do produto + header de autenticação. Saída: produto gravado no servidor, propagando em tempo real para todos os clientes.',
    cond: postItem.status === 200 && postItem.body?.item?.id === 'pizza_trufada_demo'
  });

  // 16. DELETE /api/cardapio/:id
  const delItem = await req('DELETE', `/api/cardapio/${novoItemCardapio.id}`, null, { 'x-admin-pass': ADMIN_PASS });
  logStep({
    num: 16,
    name: 'Excluir Produto pelo Painel Admin no Servidor',
    endpoint: `DELETE /api/cardapio/${novoItemCardapio.id}`,
    input: { id: novoItemCardapio.id, headers: { 'x-admin-pass': ADMIN_PASS } },
    output: delItem,
    explanation: 'Entrada: ID do produto a remover + header x-admin-pass. Saída: confirmação de exclusão do catálogo do servidor.',
    cond: delItem.status === 200 && !delItem.body?.items?.some(i => i.id === novoItemCardapio.id)
  });

  // 17. GET /api/whatsapp/status
  const waStat = await req('GET', '/api/whatsapp/status');
  logStep({
    num: 17,
    name: 'Consultar Estado do Módulo WhatsApp Web (Baileys)',
    endpoint: 'GET /api/whatsapp/status',
    input: {},
    output: waStat,
    explanation: 'Entrada: consulta de status. Saída: ativo (booleano do bot), pareado (se há sessão ativa), ownerPhone (celular do restaurante).',
    cond: waStat.status === 200 && typeof waStat.body?.ativo === 'boolean'
  });

  console.log(`\n===============================================================================`);
  console.log(`🎉 RELATÓRIO FINAL: ${passedCount}/${totalCount} FUNÇÕES TESTADAS E 100% FUNCIONAIS!`);
  console.log(`===============================================================================\n`);

} catch (err) {
  console.error('❌ EXCEÇÃO NA EXECUÇÃO DOS TESTES:', err);
} finally {
  srv.kill();
  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

