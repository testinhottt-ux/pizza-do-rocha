// test-server.mjs — Integração: sobe o servidor e testa /api/* reais (opt-in REAL)
// Uso: node test-server.mjs [--real]
//   --real : cria link InfinitePay real (requer INFINITEPAY_HANDLE)
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const REAL = process.argv.includes('--real');
const BASE = 'http://localhost:3987';

function req(method, path, body, headers = {}) {
  return fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
}

const out = [];
function ok(msg, cond, extra = '') { out.push(`${cond ? '✅' : '❌'} ${msg}${extra ? ' — ' + extra : ''}`); }

const srv = spawn('node', ['server.mjs', '3987'], { stdio: 'pipe', cwd: process.cwd() });
let stderr = '';
srv.stderr.on('data', d => stderr += d);

await sleep(1200);
try {
  const home = await fetch(BASE + '/');
  ok('index.html servido (HTTP 200)', home.status === 200, 'status=' + home.status);

  const cfg = await req('GET', '/api/config');
  ok('GET /api/config responde', cfg.status === 200, JSON.stringify(cfg.body));

  // Configura um handle de teste; o modo simulado permanece ativo.
  await req('POST', '/api/config', { infinitePayHandle: 'demo_handle' });

  const tst = await req('POST', '/api/testar-conexao');
  ok('testar-conexao', tst.status === 200, JSON.stringify(tst.body));

  const wh = await req('POST', '/api/webhook', { event: 'PAYMENT_RECEIVED', payment: { id: 'pay_teste' } });
  ok('webhook aceito', wh.status === 200, JSON.stringify(wh.body));

  // Modos de operação (simulação + landing) persistem
  await req('POST', '/api/config', { modoSimulacao: true, modoLanding: true });
  const cfg2 = await req('GET', '/api/config');
  ok('modoSimulacao/modoLanding salvos', cfg2.body?.modoSimulacao === true && cfg2.body?.modoLanding === true, JSON.stringify(cfg2.body));
  await req('POST', '/api/config', { modoSimulacao: true, modoLanding: false });

  // Cobrança simulada (PIX e Cartão) — fluxo completo sem cobrança real
  const simPix = await req('POST', '/api/pagamento', {
    nome: 'Teste Sim PIX', cpfCnpj: '12345678909', telefone: '5531999887766',
    endereco: 'Rua Teste 1', valor: 89.4, metodo: 'pix', descricao: '2x Margherita',
  });
  ok('pagamento PIX simulado', simPix.status === 200 && simPix.body?.simulacao === true, JSON.stringify(simPix.body));
  if (simPix.body?.paymentId?.startsWith('sim_')) {
    const conf = await req('POST', '/api/pagamento/' + simPix.body.paymentId + '/simular');
    ok('confirmar pagamento simulado', conf.status === 200 && conf.body?.status === 'CONFIRMED', JSON.stringify(conf.body));
  }

  const simCart = await req('POST', '/api/pagamento', {
    nome: 'Teste Sim Cartao', cpfCnpj: '98765432100', telefone: '5531888776655',
    endereco: 'Rua Teste 2', valor: 129.8, metodo: 'cartao', descricao: '1x Portuguesa',
  });
  ok('pagamento Cartão simulado', simCart.status === 200 && simCart.body?.metodo === 'cartao', JSON.stringify(simCart.body));

  // ── Pedidos no servidor (o dono precisa ver o pedido do cliente) ──
  const rotaAd = await req('GET', '/ad');
  ok('/ad entrega o site (painel oculto)', rotaAd.status === 200, 'status=' + rotaAd.status);

  const novoPedido = await req('POST', '/api/pedidos', {
    cliente: { nome: 'Cliente Teste', telefone: '5531999887766', endereco: 'Rua das Pizzas, 100', cpf: '12345678901' },
    itens: [{ nome: 'Marguerita Gigante', qtd: 2, preco: 59.99 }],
    metodo: 'pix',
  });
  const pedidoId = novoPedido.body?.pedido?.id;
  ok('pedido criado no servidor', novoPedido.status === 201 && novoPedido.body?.pedido?.total === 119.98, JSON.stringify(novoPedido.body?.pedido?.numero));
  ok('CPF é mascarado no servidor', /^\*{3}\.\*{3}\.\*{2}\d{3}$/.test(novoPedido.body?.pedido?.cliente?.cpf || ''), String(novoPedido.body?.pedido?.cliente?.cpf));

  const semItens = await req('POST', '/api/pedidos', { cliente: { nome: 'X', telefone: '5531999887766', endereco: 'Y' }, itens: [] });
  ok('pedido sem itens é rejeitado', semItens.status === 400, JSON.stringify(semItens.body));

  const semDados = await req('POST', '/api/pedidos', { cliente: { nome: '', telefone: '1', endereco: '' }, itens: [{ nome: 'P', qtd: 1, preco: 10 }] });
  ok('pedido sem nome/telefone é rejeitado', semDados.status === 400, JSON.stringify(semDados.body));

  const listaSemSenha = await req('GET', '/api/pedidos');
  ok('listar pedidos sem senha → 401', listaSemSenha.status === 401, JSON.stringify(listaSemSenha.body));

  const listaSenhaErrada = await req('GET', '/api/pedidos', null, { 'x-admin-pass': 'errada' });
  ok('listar pedidos com senha errada → 401', listaSenhaErrada.status === 401, JSON.stringify(listaSenhaErrada.body));

  const listaOk = await req('GET', '/api/pedidos', null, { 'x-admin-pass': 'pizzadorochaboademais' });
  ok('dono lista pedidos dos clientes', listaOk.status === 200 && listaOk.body?.pedidos?.some(p => p.id === pedidoId), 'total=' + listaOk.body?.total);

  const avanca = await req('POST', `/api/pedidos/${pedidoId}/status`, { status: 'preparando' }, { 'x-admin-pass': 'pizzadorochaboademais' });
  ok('dono avança o status', avanca.status === 200 && avanca.body?.pedido?.status === 'preparando', JSON.stringify(avanca.body?.pedido?.status));

  const statusInvalido = await req('POST', `/api/pedidos/${pedidoId}/status`, { status: 'hackeado' }, { 'x-admin-pass': 'pizzadorochaboademais' });
  ok('status inválido é rejeitado', statusInvalido.status === 400, JSON.stringify(statusInvalido.body));

  const pagVinc = await req('POST', `/api/pedidos/${pedidoId}/pagamento`, { status: 'aprovado', providerPaymentId: 'sim_teste' });
  ok('pagamento vinculado ao pedido', pagVinc.status === 200 && pagVinc.body?.pagamento?.status === 'aprovado', JSON.stringify(pagVinc.body?.pagamento));

  const consulta = await req('GET', `/api/pedidos/${pedidoId}`);
  ok('cliente acompanha o próprio pedido', consulta.status === 200 && consulta.body?.pedido?.status === 'preparando', JSON.stringify(consulta.body?.pedido?.status));
  ok('consulta pública não expõe endereço', consulta.body?.pedido?.cliente === undefined, JSON.stringify(Object.keys(consulta.body?.pedido || {})));

  // WhatsApp endpoints
  const waStatus = await req('GET', '/api/whatsapp/status');
  ok('GET /api/whatsapp/status', waStatus.status === 200, JSON.stringify(waStatus.body));
  const waPairInv = await req('POST', '/api/whatsapp/parear', { numero: 'abc' });
  ok('parear com número inválido rejeita', waPairInv.status === 400, JSON.stringify(waPairInv.body));
  const waSend = await req('POST', '/api/whatsapp/enviar', { numero: '5531999887766', texto: 'teste' });
  ok('enviar sem parear → notPaired', waSend.status === 409 && waSend.body?.notPaired === true, JSON.stringify(waSend.body));

  if (REAL) {
    const suf = Date.now().toString().slice(-4).replace(/[^0-9]/g, '1');
    const pag = await req('POST', '/api/pagamento', {
      nome: 'Teste Integração Codigo',
      cpfCnpj: '00000000191', // difere por 'sequencial' via externalReference
      email: 'integracao@pizzariarocha.com',
      telefone: '31996782800',
      valor: 45.90,
      descricao: `PEDIDO TESTE #${suf}`,
      externalReference: 'tst_' + suf,
    });
    ok('cobranca PIX criada', pag.status === 200, JSON.stringify(pag.body));
    if (pag.body && pag.body.paymentId) {
      const pol = await req('GET', '/api/pagamento/' + pag.body.paymentId);
      ok('polling da cobrança', pol.status === 200, JSON.stringify(pol.body));
    }
  }
} catch (e) {
  out.push('❌ EXCEÇÃO: ' + e.message);
} finally {
  srv.kill();
}

console.log('\n== RESULTADO TESTE DE INTEGRAÇÃO ==');
console.log(out.join('\n'));
console.log(stderr ? '\n-- stderr do servidor --\n' + stderr : '');
