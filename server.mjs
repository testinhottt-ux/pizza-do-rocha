// server.mjs — Backend HTTP para a Pizzaria do Rocha
// Serve os estáticos + endpoints /api/* (config, pagamento, webhook, polling).
// Uso: node server.mjs [porta]   (padrão 3000)

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as InfinitePay from './infinitepay-client.mjs';
import * as WA from './whatsapp-web.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv[2] || process.env.PORT || '3000', 10);

// ── Caminhos ──
const CONFIG_FILE = path.join(__dirname, 'server-config.json');
const LOG_DIR = path.join(__dirname, 'LOGS');
const LOG_FILE = path.join(LOG_DIR, 'servidor.log');
const WEBHOOK_LOG = path.join(LOG_DIR, 'webhook.log');
fs.mkdirSync(LOG_DIR, { recursive: true });

// ── Compradores pendentes (pedido → telefone/nome p/ enviar comprovante no webhook) ──
const BUYERS_FILE = path.join(LOG_DIR, 'compradores.json');
const BUYER_TTL_MS = 72 * 3600 * 1000; // registros antigos expiram em 72h

function lerCompradores() {
  try { return JSON.parse(fs.readFileSync(BUYERS_FILE, 'utf8')) || {}; } catch { return {}; }
}
function salvarCompradores(map) {
  try { fs.writeFileSync(BUYERS_FILE, JSON.stringify(map, null, 2)); } catch (e) { log('ERROR', 'BUYER', 'Falha ao salvar compradores', { error: e.message }); }
}
function registrarComprador(orderNsu, dados) {
  const map = lerCompradores();
  map[orderNsu] = { ...dados, criadoEm: Date.now() };
  salvarCompradores(map);
}
function removerComprador(orderNsu) {
  const map = lerCompradores();
  delete map[orderNsu];
  salvarCompradores(map);
}
function limparCompradores() {
  const map = lerCompradores();
  const agora = Date.now();
  let mudou = false;
  for (const k of Object.keys(map)) {
    if (agora - (map[k].criadoEm || 0) > BUYER_TTL_MS) { delete map[k]; mudou = true; }
  }
  if (mudou) salvarCompradores(map);
}
function formatarMoeda(cents) {
  return 'R$ ' + (Number(cents || 0) / 100).toFixed(2).replace('.', ',');
}

// ── Pedidos persistidos no servidor (fonte de verdade para o painel do dono) ──
const ORDERS_FILE = path.join(LOG_DIR, 'pedidos.json');
const MAX_ORDERS = 500;               // mantém o arquivo pequeno; descarta os mais antigos
const ADMIN_PASS_FILE = path.join(LOG_DIR, '.admin-password');
let ADMIN_PASS = (() => {
  // Tenta ler senha persistida; fallback para env ou padrão
  try {
    const savedPass = fs.readFileSync(ADMIN_PASS_FILE, 'utf8').trim();
    if (savedPass) return savedPass;
  } catch { /* não existe arquivo, usa fallback */ }
  return process.env.ADMIN_PASS || 'pizzadorochaboademais';
})();

function salvarSenhaAdmin(novaSenha) {
  try {
    fs.writeFileSync(ADMIN_PASS_FILE, novaSenha, 'utf8');
    ADMIN_PASS = novaSenha;  // atualiza em runtime
    log('INFO', 'ADMIN', 'Senha do painel alterada');
    return true;
  } catch (err) {
    log('ERROR', 'ADMIN', 'Falha ao salvar senha', { error: err.message });
    return false;
  }
}

const STATUS_FLOW = ['recebido', 'preparando', 'forno', 'saiu_entrega', 'entregue'];
const STATUS_VALIDOS = [...STATUS_FLOW, 'cancelado'];

function lerPedidos() {
  try {
    const arr = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function salvarPedidos(lista) {
  const corte = lista.slice(-MAX_ORDERS);
  const tmp = ORDERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(corte, null, 2));
  fs.renameSync(tmp, ORDERS_FILE);   // troca atômica: nunca deixa arquivo pela metade
  return corte;
}
function ehAdmin(req) {
  const enviado = req.headers['x-admin-pass'];
  return typeof enviado === 'string' && enviado === ADMIN_PASS;
}

// ── Cardápio persistido no servidor (fonte de verdade compartilhada para todos) ──
const CARDAPIO_FILE = path.join(LOG_DIR, 'cardapio.json');

function obterCardapioPadrao() {
  return [
    { id: 'propaganda_0', nome: 'Portuguesa (à moda) · Média', categoria: 'Pizza média · 30 cm · 6 pedaços', preco: 49.99, descricao: 'Molho, presunto, cebola, pimentão, bacon, tomate, ovos, muçarela, queijo parmesão ralado, azeitona e orégano.', foto: 'images/pizza-portuguesa.jpg', estoque: 999, ativo: true, destaque: true },
    { id: 'propaganda_1', nome: 'Portuguesa (à moda) · Gigante', categoria: 'Pizza gigante · 35 cm · 8 pedaços', preco: 59.99, descricao: 'Molho, presunto, cebola, pimentão, bacon, tomate, ovos, muçarela, queijo parmesão ralado, azeitona e orégano.', foto: 'images/pizza-portuguesa.jpg', estoque: 999, ativo: true, destaque: true },
    { id: 'propaganda_2', nome: 'Calabresa · Média', categoria: 'Pizza média · 30 cm · 6 pedaços', preco: 49.99, descricao: 'Molho, frango desfiado, muçarela, calabresa desfiada, cebola, queijo parmesão ralado e orégano.', foto: 'images/pizza-calabresa.jpg', estoque: 999, ativo: true, destaque: false },
    { id: 'propaganda_3', nome: 'Calabresa · Gigante', categoria: 'Pizza gigante · 35 cm · 8 pedaços', preco: 59.99, descricao: 'Molho, frango desfiado, muçarela, calabresa desfiada, cebola, queijo parmesão ralado e orégano.', foto: 'images/pizza-calabresa.jpg', estoque: 999, ativo: true, destaque: false },
    { id: 'propaganda_4', nome: 'Presunto com muçarela · Média', categoria: 'Pizza média · 30 cm · 6 pedaços', preco: 49.99, descricao: 'Molho de tomate, presunto, bacon, tomate, cebola, muçarela, queijo parmesão e orégano.', foto: 'images/pizza-mussarela-artesanal.jpg', estoque: 999, ativo: true, destaque: false },
    { id: 'propaganda_5', nome: 'Presunto com muçarela · Gigante', categoria: 'Pizza gigante · 35 cm · 8 pedaços', preco: 59.99, descricao: 'Molho de tomate, presunto, bacon, tomate, cebola, muçarela, queijo parmesão e orégano.', foto: 'images/pizza-mussarela-artesanal.jpg', estoque: 999, ativo: true, destaque: false },
    { id: 'propaganda_6', nome: 'Marguerita · Média', categoria: 'Pizza média · 30 cm · 6 pedaços', preco: 49.99, descricao: 'Molho, muçarela, tomate, manjericão, queijo ralado e orégano.', foto: 'images/pizza-margherita.jpg', estoque: 999, ativo: true, destaque: false },
    { id: 'propaganda_7', nome: 'Marguerita · Gigante', categoria: 'Pizza gigante · 35 cm · 8 pedaços', preco: 59.99, descricao: 'Molho, muçarela, tomate, manjericão, queijo ralado e orégano.', foto: 'images/pizza-margherita.jpg', estoque: 999, ativo: true, destaque: false },
    { id: 'propaganda_8', nome: '1/2 Salaminho e 1/2 Lombinho Canadense · Média', categoria: 'Pizza média · 30 cm · 6 pedaços', preco: 49.99, descricao: 'Metade salaminho especial com muçarela e orégano, metade lombinho canadense fatiado com queijo e temperos da casa.', foto: 'images/pizza-meio-salaminho-lombinho.jpg', estoque: 999, ativo: true, destaque: true },
    { id: 'propaganda_9', nome: '1/2 Salaminho e 1/2 Lombinho Canadense · Gigante', categoria: 'Pizza gigante · 35 cm · 8 pedaços', preco: 59.99, descricao: 'Metade salaminho especial com muçarela e orégano, metade lombinho canadense fatiado com queijo e temperos da casa.', foto: 'images/pizza-meio-salaminho-lombinho.jpg', estoque: 999, ativo: true, destaque: false },
    { id: 'bebida_propaganda_0', nome: 'Coca-Cola · 2 Litros', categoria: 'Bebidas · 2 Litros', preco: 13.99, descricao: 'Refrigerante Coca-Cola 2 litros gelado, ideal para acompanhar sua pizza.', foto: 'images/bebida-cola.svg', estoque: 120, ativo: true, destaque: false },
    { id: 'bebida_propaganda_1', nome: 'Guaraná Antarctica · 2 Litros', categoria: 'Bebidas · 2 Litros', preco: 13.99, descricao: 'Refrigerante Guaraná Antarctica 2 litros gelado, sabor original.', foto: 'images/bebida-guarana.svg', estoque: 120, ativo: true, destaque: false },
  ];
}

function lerCardapio() {
  try {
    if (fs.existsSync(CARDAPIO_FILE)) {
      const arr = JSON.parse(fs.readFileSync(CARDAPIO_FILE, 'utf8'));
      if (Array.isArray(arr) && arr.length > 0) {
        // 1. Remove qualquer resíduo de água e suco
        let limpo = arr.filter(i => !/[áa]gua|mineral|suco/i.test(i?.nome || '') && !/[áa]gua|mineral|suco/i.test(i?.descricao || ''));
        
        // 2. Atualiza nomes, categorias, descrições e preços dos refrigerantes para 2 Litros e R$ 13,99
        limpo = limpo.map(i => {
          if (/coca/i.test(i?.nome || '')) {
            return {
              ...i,
              nome: 'Coca-Cola · 2 Litros',
              categoria: 'Bebidas · 2 Litros',
              preco: 13.99,
              descricao: 'Refrigerante Coca-Cola 2 litros gelado, ideal para acompanhar sua pizza.'
            };
          }
          if (/guaran[aá]/i.test(i?.nome || '')) {
            return {
              ...i,
              nome: 'Guaraná Antarctica · 2 Litros',
              categoria: 'Bebidas · 2 Litros',
              preco: 13.99,
              descricao: 'Refrigerante Guaraná Antarctica 2 litros gelado, sabor original.'
            };
          }
          return i;
        });

        // 3. Adiciona itens do catálogo base que ainda não estejam presentes (ex: 1/2 Salaminho)
        const padrao = obterCardapioPadrao();
        for (const itemPadrao of padrao) {
          if (!limpo.some(i => i.id === itemPadrao.id || i.nome === itemPadrao.nome)) {
            limpo.push(itemPadrao);
          }
        }

        if (JSON.stringify(limpo) !== JSON.stringify(arr)) {
          salvarCardapio(limpo);
        }
        return limpo;
      }
    }
  } catch (e) {
    log('WARN', 'CARDAPIO', 'Falha ao ler cardapio.json, usando padrão', { error: e.message });
  }
  const padrao = obterCardapioPadrao();
  salvarCardapio(padrao);
  return padrao;
}

function salvarCardapio(lista) {
  try {
    const tmp = CARDAPIO_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(lista, null, 2), 'utf8');
    fs.renameSync(tmp, CARDAPIO_FILE);
    return lista;
  } catch (e) {
    log('ERROR', 'CARDAPIO', 'Falha ao salvar cardapio', { error: e.message });
    return lista;
  }
}
function texto(v, max = 200) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}
function mascararCpf(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length < 4) return '';
  return '***.***.**' + d.slice(-3);  // o CPF completo fica só com a InfinitePay
}
function proximoNumero(lista) {
  const maior = lista.reduce((m, o) => Math.max(m, Number(o.numero) || 0), 1000);
  return maior + 1;
}
function normalizarItens(itens) {
  if (!Array.isArray(itens)) return [];
  return itens.slice(0, 50).map((i) => ({
    nome: texto(i?.nome, 120) || 'Item',
    qtd: Math.min(99, Math.max(1, parseInt(i?.qtd, 10) || 1)),
    preco: Math.max(0, Number(i?.preco) || 0),
  }));
}
function resumoPedido(o) {
  return `#${o.numero} — ${o.cliente?.nome || 'Cliente'} · ` +
    o.itens.map((i) => `${i.qtd}x ${i.nome}`).join(', ') +
    ` · R$ ${o.total.toFixed(2).replace('.', ',')}`;
}

// Encontra o pedido do servidor a partir da referência enviada à InfinitePay.
function buscarPedidoPorNsu(orderNsu) {
  const lista = lerPedidos();
  const nsu = String(orderNsu || '');
  const porId = lista.find((o) => o.id === nsu);
  if (porId) return porId;
  const m = nsu.match(/^ped_(\d+)$/);
  if (m) return lista.find((o) => Number(o.numero) === parseInt(m[1], 10)) || null;
  return null;
}

// Registra o comprador p/ o webhook (produção e simulação usam o MESMO fluxo)
function registrarCompradorDoBody(body, orderNsu) {
  if (!body?.telefone && !body?.nome) return;
  registrarComprador(orderNsu, {
    telefone: String(body.telefone || '').replace(/\D/g, ''),
    nome: String(body.nome || '').trim(),
    valorCents: Math.round(Number(body.valor) * 100),
    numeroPedido: String(body.externalReference || orderNsu),
    endereco: String(body.endereco || '').trim().slice(0, 200),
    metodo: body.metodo === 'cartao' ? 'cartao' : 'pix',
    descricao: String(body.descricao || '').slice(0, 300),
  });
  limparCompradores();
  log('INFO', 'BUYER', 'Comprador registrado para comprovante', { orderNsu, telefone: String(body.telefone || '') });
}

// Texto dos itens de um pedido, ex.: "2x Marguerita, 1x Portuguesa"
function textoItens(itens) {
  return (Array.isArray(itens) ? itens : []).filter((i) => i && i.nome)
    .map((i) => `${i.qtd}× ${i.nome}`).join(', ');
}

// Monta + envia as duas mensagens de "pagamento confirmado" (comprador e dono).
// Raw é o payload do webhook real, ou um objeto simulado em modo de teste.
async function enviarMensagensPagamentoConfirmado(orderNsu, buyer, raw = {}) {
  const cfg = lerConfig();
  const pedido = buscarPedidoPorNsu(orderNsu);
  const numeroPedido = pedido?.numero ?? buyer?.numeroPedido ?? String(orderNsu || '').replace(/^ped_/, '#');
  const itensTxt = pedido ? textoItens(pedido.itens) : (buyer?.descricao || '');
  const valorCents = Number(raw?.amount ?? buyer?.valorCents ?? (pedido ? Math.round((pedido.total || 0) * 100) : 0));
  const forma = metodoLabel(raw?.capture_method || (buyer?.metodo === 'cartao' ? 'cartao' : 'pix'));
  const endereco = (pedido?.cliente?.endereco || buyer?.endereco || '').trim();
  const nome = buyer?.nome || pedido?.cliente?.nome || '';
  const numExib = String(numeroPedido).replace(/^ped_/, '#');

  const textoComprador = [
    `✅ Pagamento confirmado, ${nome ? nome.split(' ')[0] + '!' : 'tudo certo!'}`,
    '',
    `🍕 Pizzaria do Rocha — Pedido ${numExib}`,
    itensTxt ? `Itens: ${itensTxt}` : null,
    `Valor total: ${formatarMoeda(valorCents)}`,
    `Forma: ${forma}`,
    endereco ? `📍 Entrega: ${endereco}` : null,
    '',
    `📄 Comprovante oficial:`,
    raw?.receipt_url || 'https://www.infinitepay.io',
    '',
    `Seu pedido está sendo preparado! Qualquer dúvida é só chamar. 🍕`,
  ].filter(Boolean).join('\n');

  const r = await WA.enviarSeguro(buyer?.telefone || pedido?.cliente?.telefone || '', textoComprador, 'pagamento-cliente');
  log(r.ok ? 'SUCCESS' : 'WARN', 'WHATSAPP', 'Comprovante enviado ao comprador', { orderNsu, to: buyer?.telefone || '', ok: r.ok, error: r.error });

  // Dono também recebe (se for número diferente do comprador)
  const textoDono = [
    `💰 Pedido ${numExib} PAGO — ${formatarMoeda(valorCents)} (${forma})`,
    itensTxt ? `Itens: ${itensTxt}` : null,
    buyer?.telefone ? `📞 ${buyer.telefone}` : null,
    endereco ? `📍 ${endereco}` : null,
  ].filter(Boolean).join('\n');
  if (cfg.whatsappNotif && cfg.whatsappNotif !== buyer?.telefone) {
    await WA.enviarSeguro(cfg.whatsappNotif, textoDono, 'pagamento-dono');
  }
  return r;
}
function metodoLabel(m) {
  if (m === 'pix') return 'PIX';
  if (m === 'credit_card' || m === 'creditCard') return 'Cartão de crédito';
  if (m === 'debit_card') return 'Cartão de débito';
  return 'Pagamento';
}

// ── Config persistente (chaves ficam no servidor) ──
const DEFAULT_CONFIG = {
  infinitePayHandle: process.env.INFINITEPAY_HANDLE || '',
  whatsappNotif: '5531991867625',
  modoSimulacao: true,
  // Modo landing: o site vira cardápio + pedir via WhatsApp (sem compra/sistema).
  modoLanding: false,
};

function lerConfig() {
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }; }
  catch { return { ...DEFAULT_CONFIG }; }
}
function salvarConfig(partial) {
  const cfg = { ...lerConfig(), ...partial };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  return cfg;
}
// ── Logging ──
function log(level, component, message, data = {}) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] [${component}] ${message}` + (Object.keys(data).length ? ' ' + JSON.stringify(data) : '');
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Rate Limiting em memória por IP ──
const rateLimits = new Map();
function verificarRateLimit(ip, chave, maxTentativas, janelaMs) {
  const agora = Date.now();
  const id = `${ip || 'local'}:${chave}`;
  const registro = rateLimits.get(id) || { count: 0, expira: agora + janelaMs };
  if (agora > registro.expira) {
    registro.count = 0;
    registro.expira = agora + janelaMs;
  }
  registro.count++;
  rateLimits.set(id, registro);
  return registro.count <= maxTentativas;
}

function aplicarSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// ── MIME ──
const MIME = {
  '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.webmanifest':'application/manifest+json',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.txt':'text/plain'
};

// ── Helpers ──
function sendJson(res, code, obj) {
  aplicarSecurityHeaders(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((res, rej) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 2e6) req.destroy(); });
    req.on('end', () => { try { res(b ? JSON.parse(b) : {}); } catch { rej(new Error('JSON inválido')); } });
    req.on('error', rej);
  });
}
function novoVencimento() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0];
}
function servirEstatico(req, res, caminho) {
  let p = decodeURIComponent(caminho).replace(/\/+/g, '/');
  if (p === '/' || p === '') p = '/index.html';
  // Rota secreta do painel: /ad, /admin, /ad/, /admin/ entrega o próprio site que abre o painel
  if (p === '/ad' || p === '/admin' || p === '/ad/' || p === '/admin/') {
    p = '/index.html';
  }
  // Rotas de documentação e arquitetura Mermaid
  if (p === '/docs' || p === '/docs/' || p === '/arquitetura' || p === '/arquitetura/') {
    p = '/docs/arquitetura-mermaid.html';
  }

  // Bloqueio de segurança: arquivos ocultos, diretórios internos e arquivos sensíveis
  if (/(^|\/)\./.test(p) || /^\/(LOGS|wa-session|node_modules|vps|tests|uploads)\b/i.test(p) || /\.(mjs|md|json|ya?ml|env|log|pid|bak)$/i.test(p)) {
    // Permite apenas manifest.json
    if (p !== '/manifest.json') {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
  }

  const abs = path.normalize(path.join(__dirname, p));
  if (!abs.startsWith(__dirname)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(abs, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    aplicarSecurityHeaders(res);
    const ext = path.extname(abs).toLowerCase();
    const isMedia = /\.(png|jpe?g|svg|webp|ico|woff2?|ttf)$/i.test(ext);
    // Para HTML, JS, CSS, SW e Manifest: NUNCA usar cache local (sempre entrega a versão mais recente)
    const cacheHeader = isMedia
      ? 'public, max-age=3600, stale-while-revalidate=86400'
      : 'no-cache, no-store, must-revalidate, max-age=0';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheHeader,
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(buf);
  });
}

// ── Endpoints /api ──
async function handleApi(req, res, caminho) {
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

  // GET /api/config
  if (caminho === '/api/config' && req.method === 'GET') {
    const cfg = lerConfig();
    return sendJson(res, 200, {
      infinitePayConfigured: Boolean(cfg.infinitePayHandle || InfinitePay.getConfig().handle),
      infinitePayHandle: cfg.infinitePayHandle || InfinitePay.getConfig().handle,
      whatsappNotif: cfg.whatsappNotif,
      modoSimulacao: cfg.modoSimulacao,
      modoLanding: cfg.modoLanding,
      whatsapp: WA.getStatus(),
    });
  }
  // POST /api/config — opções públicas; credenciais ficam em variáveis de ambiente
  if (caminho === '/api/config' && req.method === 'POST') {
    const body = await readBody(req);
    const patch = {};
    if (typeof body.infinitePayHandle === 'string' && /^\$?[A-Za-z0-9_.-]{3,80}$/.test(body.infinitePayHandle.trim())) patch.infinitePayHandle = body.infinitePayHandle.trim();
    if (typeof body.modoSimulacao === 'boolean') patch.modoSimulacao = body.modoSimulacao;
    if (typeof body.modoLanding === 'boolean') patch.modoLanding = body.modoLanding;
    const waCandidate = typeof body.whatsappNotif === 'string' ? body.whatsappNotif : (typeof body.whatsapp === 'string' ? body.whatsapp : null);
    if (waCandidate) {
      const digits = waCandidate.replace(/\D/g, '');
      if (/^\d{10,15}$/.test(digits)) patch.whatsappNotif = digits;
    }
    const cfg = salvarConfig(patch);
    log('INFO', 'ADMIN', 'Config salva no servidor', { infinitePayHandle: cfg.infinitePayHandle, whatsappNotif: cfg.whatsappNotif, modoSimulacao: cfg.modoSimulacao, modoLanding: cfg.modoLanding });
    return sendJson(res, 200, { ok: true, infinitePayHandle: cfg.infinitePayHandle, whatsappNotif: cfg.whatsappNotif, modoSimulacao: cfg.modoSimulacao, modoLanding: cfg.modoLanding });
  }
  // POST /api/admin/login — a senha do painel é conferida no servidor com rate limit
  if (caminho === '/api/admin/login' && req.method === 'POST') {
    if (!verificarRateLimit(clientIp, 'admin-login', 10, 5 * 60 * 1000)) {
      log('WARN', 'SECURITY', 'Rate limit excedido em /api/admin/login', { ip: clientIp });
      return sendJson(res, 429, { ok: false, error: 'Muitas tentativas. Aguarde 5 minutos.' });
    }
    const body = await readBody(req);
    const senha = String(body.senha || '').trim();
    await new Promise(r => setTimeout(r, 350)); // atraso fixo desestimula força bruta
    if (senha !== ADMIN_PASS) {
      log('WARN', 'ADMIN', 'Tentativa de login com senha incorreta');
      return sendJson(res, 401, { ok: false, error: 'Senha incorreta' });
    }
     log('INFO', 'ADMIN', 'Login no painel autorizado');
     return sendJson(res, 200, { ok: true });
   }
   // POST /api/admin/change-password — mudar a senha do painel
   if (caminho === '/api/admin/change-password' && req.method === 'POST') {
     const body = await readBody(req);
     const senhaAtual = String(body.senhaAtual || '').trim();
     const novaSenha = String(body.novaSenha || '').trim();
     
     // Validações
     if (!senhaAtual || !novaSenha) {
       return sendJson(res, 400, { error: 'Senha atual e nova senha são obrigatórias' });
     }
     if (novaSenha.length < 8) {
       return sendJson(res, 400, { error: 'Nova senha deve ter mínimo 8 caracteres' });
     }
     if (senhaAtual === novaSenha) {
       return sendJson(res, 400, { error: 'Nova senha igual à anterior' });
     }
     
     // Verifica senha atual
     await new Promise(r => setTimeout(r, 350)); // atraso para desestimular força bruta
     if (senhaAtual !== ADMIN_PASS) {
       log('WARN', 'ADMIN', 'Tentativa de mudar senha com senha atual incorreta');
       return sendJson(res, 401, { error: 'Senha atual incorreta' });
     }
     
     // Salva a nova senha
     if (!salvarSenhaAdmin(novaSenha)) {
       return sendJson(res, 500, { error: 'Falha ao salvar nova senha' });
     }
     
     log('INFO', 'ADMIN', 'Senha do painel alterada com sucesso');
     return sendJson(res, 200, { ok: true, message: 'Senha atualizada' });
   }
   // ── PEDIDOS ──────────────────────────────────────────────────────────────
  // POST /api/pedidos — o cliente registra o pedido NO SERVIDOR (dono enxerga no painel)
  if (caminho === '/api/pedidos' && req.method === 'POST') {
    const body = await readBody(req);
    const itens = normalizarItens(body.itens);
    const nome = texto(body?.cliente?.nome, 80);
    const telefone = String(body?.cliente?.telefone || '').replace(/\D/g, '').slice(0, 15);
    const endereco = texto(body?.cliente?.endereco, 200);
    if (!itens.length) return sendJson(res, 400, { error: 'Pedido sem itens' });
    if (!nome || telefone.length < 10 || !endereco) {
      return sendJson(res, 400, { error: 'Informe nome, telefone (DDD + número) e endereço' });
    }
    const lista = lerPedidos();
    const total = itens.reduce((s, i) => s + i.qtd * i.preco, 0); // total é recalculado aqui
    const pedido = {
      id: 'ped_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      numero: proximoNumero(lista),
      itens,
      total,
      cliente: { nome, telefone, endereco, cpf: mascararCpf(body?.cliente?.cpf) },
      pagamento: {
        metodo: body?.metodo === 'cartao' ? 'cartao' : 'pix',
        status: 'pendente',
        provider: 'infinitepay',
        providerPaymentId: null,
      },
      status: 'recebido',
      criadoEm: Date.now(),
      atualizadoEm: Date.now(),
    };
    lista.push(pedido);
    salvarPedidos(lista);
    log('SUCCESS', 'PEDIDO', 'Pedido registrado no servidor', { numero: pedido.numero, total, itens: itens.length });
    // Avisa o dono na hora (falha de WhatsApp não derruba o pedido)
    const cfg = lerConfig();
    if (cfg.whatsappNotif) {
      WA.enviarSeguro(cfg.whatsappNotif, `🍕 NOVO PEDIDO ${resumoPedido(pedido)}\n📞 ${telefone}\n📍 ${endereco}`, 'novo-pedido')
        .then((r) => log(r.ok ? 'INFO' : 'WARN', 'WHATSAPP', 'Aviso de novo pedido ao dono', { numero: pedido.numero, ok: r.ok }))
        .catch(() => {});
    }
    return sendJson(res, 201, { ok: true, pedido });
  }
  // GET /api/pedidos — lista completa (somente o dono, exige senha do painel)
  if (caminho === '/api/pedidos' && req.method === 'GET') {
    if (!ehAdmin(req)) {
      log('WARN', 'PEDIDO', 'Tentativa de listar pedidos sem senha de admin');
      return sendJson(res, 401, { error: 'Não autorizado' });
    }
    const lista = lerPedidos().sort((a, b) => b.criadoEm - a.criadoEm);
    return sendJson(res, 200, { ok: true, total: lista.length, pedidos: lista });
  }
  // GET /api/pedidos/:id — acompanhamento do próprio pedido (o id funciona como chave)
  if (/^\/api\/pedidos\/[^/]+$/.test(caminho) && req.method === 'GET') {
    const id = caminho.split('/')[3];
    const pedido = lerPedidos().find((o) => o.id === id);
    if (!pedido) return sendJson(res, 404, { error: 'Pedido não encontrado' });
    return sendJson(res, 200, {
      ok: true,
      pedido: { id: pedido.id, numero: pedido.numero, itens: pedido.itens, total: pedido.total, status: pedido.status, pagamento: pedido.pagamento, criadoEm: pedido.criadoEm },
    });
  }
  // POST /api/pedidos/:id/status — avança o status (somente o dono) e avisa o cliente no WhatsApp
  if (/^\/api\/pedidos\/[^/]+\/status$/.test(caminho) && req.method === 'POST') {
    if (!ehAdmin(req)) return sendJson(res, 401, { error: 'Não autorizado' });
    const id = caminho.split('/')[3];
    const body = await readBody(req);
    const novo = texto(body.status, 20);
    if (!STATUS_VALIDOS.includes(novo)) return sendJson(res, 400, { error: 'Status inválido', validos: STATUS_VALIDOS });
    const lista = lerPedidos();
    const pedido = lista.find((o) => o.id === id);
    if (!pedido) return sendJson(res, 404, { error: 'Pedido não encontrado' });
    pedido.status = novo;
    pedido.atualizadoEm = Date.now();
    salvarPedidos(lista);
    log('INFO', 'PEDIDO', 'Status atualizado', { numero: pedido.numero, status: novo });
    // Sincronia no WhatsApp: o cliente é avisado a cada mudança de estado.
    const STATUS_MSG = {
      recebido: `✅ Pedido ${pedido.numero} recebido! Já estamos preparando sua pizza.`,
      preparando: `👨‍🍳 Pedido ${pedido.numero} está sendo preparado!`,
      forno: `🔥 Pedido ${pedido.numero} foi para o forno!`,
      saiu_entrega: `🛵 Pedido ${pedido.numero} saiu para entrega!`,
      entregue: `🍕 Pedido ${pedido.numero} entregue! Bom apetite!`,
      cancelado: `❌ Pedido ${pedido.numero} foi cancelado. Qualquer dúvida, chame no WhatsApp.`,
    };
    const txtStatus = STATUS_MSG[novo];
    if (txtStatus && pedido?.cliente?.telefone) {
      WA.enviarSeguro(pedido.cliente.telefone, txtStatus, 'status-' + novo)
        .then((r) => log(r.ok ? 'INFO' : 'WARN', 'WHATSAPP', 'Status enviado ao cliente', { numero: pedido.numero, status: novo, ok: r.ok, error: r.error }))
        .catch(() => {});
    }
    return sendJson(res, 200, { ok: true, pedido });
  }
  // POST /api/pedidos/:id/pagamento — vincula o pagamento ao pedido
  if (/^\/api\/pedidos\/[^/]+\/pagamento$/.test(caminho) && req.method === 'POST') {
    const id = caminho.split('/')[3];
    const body = await readBody(req);
    const lista = lerPedidos();
    const pedido = lista.find((o) => o.id === id);
    if (!pedido) return sendJson(res, 404, { error: 'Pedido não encontrado' });
    const patch = {};
    if (body.providerPaymentId) patch.providerPaymentId = texto(body.providerPaymentId, 120);
    if (['pendente', 'aprovado', 'recusado'].includes(body.status)) patch.status = body.status;
    if (typeof body.simulacao === 'boolean') patch.simulacao = body.simulacao;
    pedido.pagamento = { ...pedido.pagamento, ...patch };
    pedido.atualizadoEm = Date.now();
    salvarPedidos(lista);
    log('INFO', 'PEDIDO', 'Pagamento vinculado', { numero: pedido.numero, status: pedido.pagamento.status });
    return sendJson(res, 200, { ok: true, pagamento: pedido.pagamento });
  }

  // ── CARDÁPIO / PRODUTOS (SINCRONIZAÇÃO MULTI-CLIENTE EM TEMPO REAL) ─────────
  // GET /api/cardapio — catálogo completo público para todos os visitantes
  if (caminho === '/api/cardapio' && req.method === 'GET') {
    const items = lerCardapio();
    return sendJson(res, 200, { ok: true, total: items.length, items });
  }

  // POST /api/cardapio — salvar lista completa ou atualizar (somente admin)
  if (caminho === '/api/cardapio' && req.method === 'POST') {
    if (!ehAdmin(req)) {
      log('WARN', 'CARDAPIO', 'Tentativa de salvar cardápio sem senha de admin');
      return sendJson(res, 401, { error: 'Não autorizado' });
    }
    const body = await readBody(req);
    let lista = lerCardapio();
    if (Array.isArray(body.items)) {
      lista = salvarCardapio(body.items);
      log('INFO', 'CARDAPIO', 'Cardápio completo atualizado pelo admin', { total: lista.length });
      return sendJson(res, 200, { ok: true, total: lista.length, items: lista });
    }
    const item = body.item || body;
    if (item && item.nome && typeof item.preco === 'number') {
      const id = item.id || ('item_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
      const itemFormatado = { ...item, id };
      const idx = lista.findIndex(i => i.id === id);
      if (idx >= 0) {
        lista[idx] = { ...lista[idx], ...itemFormatado };
      } else {
        lista.push(itemFormatado);
      }
      salvarCardapio(lista);
      log('INFO', 'CARDAPIO', 'Item salvo no cardápio pelo admin', { id, nome: item.nome });
      return sendJson(res, 200, { ok: true, item: itemFormatado, items: lista });
    }
    return sendJson(res, 400, { error: 'Dados do item inválidos' });
  }

  // POST /api/cardapio/item — cadastrar / atualizar item individualmente (somente admin)
  if (caminho === '/api/cardapio/item' && req.method === 'POST') {
    if (!ehAdmin(req)) {
      log('WARN', 'CARDAPIO', 'Tentativa de salvar item sem senha de admin');
      return sendJson(res, 401, { error: 'Não autorizado' });
    }
    const body = await readBody(req);
    const item = body.item || body;
    if (!item || !item.nome || typeof item.preco !== 'number') {
      return sendJson(res, 400, { error: 'Informe nome e preço válidos' });
    }
    const lista = lerCardapio();
    const id = item.id || ('item_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    const itemFormatado = { ...item, id };
    const idx = lista.findIndex(i => i.id === id);
    if (idx >= 0) {
      lista[idx] = { ...lista[idx], ...itemFormatado };
    } else {
      lista.push(itemFormatado);
    }
    salvarCardapio(lista);
    log('INFO', 'CARDAPIO', 'Item atualizado no servidor pelo admin', { id, nome: item.nome, preco: item.preco });
    return sendJson(res, 200, { ok: true, item: itemFormatado, items: lista });
  }

  // DELETE /api/cardapio/:id — remover produto do cardápio (somente admin)
  if (/^\/api\/cardapio\/[^/]+$/.test(caminho) && req.method === 'DELETE') {
    if (!ehAdmin(req)) {
      log('WARN', 'CARDAPIO', 'Tentativa de deletar item sem senha de admin');
      return sendJson(res, 401, { error: 'Não autorizado' });
    }
    const id = decodeURIComponent(caminho.replace(/^\/api\/cardapio\//, ''));
    let lista = lerCardapio();
    const antes = lista.length;
    lista = lista.filter(i => i.id !== id);
    salvarCardapio(lista);
    log('INFO', 'CARDAPIO', 'Item deletado do cardápio', { id, removido: antes > lista.length });
    return sendJson(res, 200, { ok: true, items: lista });
  }

  // POST /api/testar-conexao
  if (caminho === '/api/testar-conexao' && req.method === 'POST') {
    const cfg = lerConfig();
    const handle = cfg.infinitePayHandle || InfinitePay.getConfig().handle;
    const valid = Boolean(handle);
    const r = { valid, status: valid ? 'CONFIGURED' : 'NOT_CONFIGURED', message: valid ? 'InfinitePay configurada' : 'INFINITEPAY_HANDLE não configurado' };
    log(valid ? 'INFO' : 'ERROR', 'INFINITEPAY', 'Teste de configuração', { valid });
    return sendJson(res, valid ? 200 : 400, r);
  }
  // POST /api/pagamento — cria checkout InfinitePay ou cobrança simulada
  if (caminho === '/api/pagamento' && req.method === 'POST') {
    const body = await readBody(req);
    const cfg = lerConfig();
    const metodo = body.metodo === 'cartao' ? 'cartao' : 'pix';
    const t0 = Date.now();
    if (cfg.modoSimulacao) {
      const fakeId = 'sim_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      // Mesmo em simulação registra o comprador: garante que SIMULAÇÃO e PRODUÇÃO
      // usam o mesmo pipeline de mensagens quando o pagamento é confirmado.
      const orderNsuSim = body.externalReference || `ped_${Date.now()}`;
      registrarCompradorDoBody(body, orderNsuSim);
      const resp = {
        sucesso: true, simulacao: true, env: 'SIMULAÇÃO',
        metodo,
        paymentId: fakeId,
        descricao: body.descricao, valor: body.valor,
        checkoutUrl: null,
        externalReference: orderNsuSim,
        status: 'PENDING',
        whatsappNotif: cfg.whatsappNotif,
      };
       log('SUCCESS', 'SIMUL', 'Checkout simulado criado', { paymentId: fakeId, valor: body.valor, metodo, ms: Date.now() - t0 });
       return sendJson(res, 200, resp);
    }
    const handle = cfg.infinitePayHandle || InfinitePay.getConfig().handle;
    if (!handle) return sendJson(res, 400, { error: 'InfinitePay não configurada', message: 'Defina INFINITEPAY_HANDLE ou ative o modo simulação' });
    try {
      const orderNsu = body.externalReference || `ped_${Date.now()}`;
      // Guarda o telefone/nome do comprador p/ o webhook mandar o comprovante no WhatsApp
      registrarCompradorDoBody(body, orderNsu);
      const checkout = await InfinitePay.criarCheckout({
        handle,
        orderNsu,
        redirectUrl: body.redirectUrl || InfinitePay.getConfig().redirectUrl,
        webhookUrl: body.webhookUrl || InfinitePay.getConfig().webhookUrl,
        items: [{ quantity: 1, price: Math.round(Number(body.valor) * 100), description: body.descricao || 'Pedido Pizzaria do Rocha' }],
        customer: body.nome || body.email || body.telefone ? { name: body.nome, email: body.email, phone_number: body.telefone } : undefined,
      });
      const resp = {
        sucesso: true, env: 'PRODUÇÃO', metodo,
        paymentId: checkout.invoice_slug || checkout.slug || orderNsu,
        checkoutUrl: checkout.url,
        externalReference: orderNsu, status: 'PENDING',
        whatsappNotif: cfg.whatsappNotif,
      };
      log('SUCCESS', 'INFINITEPAY', 'Checkout criado', { paymentId: resp.paymentId, valor: body.valor, metodo, ms: Date.now() - t0 });
      return sendJson(res, 200, resp);
    } catch (err) {
      log('ERROR', 'INFINITEPAY', 'Falha ao criar checkout', { error: err.message, ms: Date.now() - t0 });
      return sendJson(res, 500, { erro: err.message });
    }
  }
  // GET /api/pagamento/:id — InfinitePay usa webhook; fallback permanece pendente
  if (caminho.startsWith('/api/pagamento/') && req.method === 'GET') {
    const cfg = lerConfig();
    const id = caminho.split('/')[3];
    if (id.startsWith('sim_')) {
      // Em simulação, o status é controlado via POST /api/pagamento/:id/simular (abaixo)
      return sendJson(res, 200, { status: 'PENDING', paymentId: id, simulacao: true });
    }
    return sendJson(res, 200, { status: 'PENDING', paymentId: id, provider: 'infinitepay', message: 'A confirmação é feita pelo webhook.' });
  }
  // POST /api/pagamento/:id/simular — confirma uma cobrança simulada (fluxo de teste).
  // Agora dispara o MESMO pipeline de mensagens do webhook real (comprador + dono).
  if (/^\/api\/pagamento\/[^/]+\/simular$/.test(caminho) && req.method === 'POST') {
    const id = caminho.split('/')[3];
    if (!id.startsWith('sim_')) return sendJson(res, 400, { error: 'Só para cobranças simuladas' });
    const body = await readBody(req);
    const orderNsu = body.externalReference || body.orderNsu || '';
    if (orderNsu) {
      const buyer = lerCompradores()[orderNsu];
      if (buyer && buyer.telefone) {
        const fakeRaw = {
          amount: buyer.valorCents,
          capture_method: buyer.metodo === 'cartao' ? 'credit_card' : 'pix',
          receipt_url: `https://www.infinitepay.io/pagamentos/${id}`,
        };
        const r = await enviarMensagensPagamentoConfirmado(orderNsu, buyer, fakeRaw);
        if (r.ok) removerComprador(orderNsu);
      } else {
        log('DEBUG', 'SIMUL', 'Simulação sem comprador registrado', { orderNsu });
      }
    }
    log('SUCCESS', 'SIMUL', 'Pagamento simulado confirmado', { paymentId: id });
    return sendJson(res, 200, { status: 'CONFIRMED', paymentId: id, simulacao: true });
  }
  // POST /api/webhook-infinitepay — confirma pagamento, envia comprovante ao comprador e avisa o dono
  if ((caminho === '/api/webhook-infinitepay' || caminho === '/api/webhook') && req.method === 'POST') {
    const raw = await readBody(req);
    const ts = new Date().toISOString();
    fs.appendFileSync(WEBHOOK_LOG, JSON.stringify({ ts, provider: 'infinitepay', payload: raw }) + '\n');
    const orderNsu = raw?.order_nsu;
    const paid = Boolean(raw?.transaction_nsu && (raw?.invoice_slug || raw?.slug));
    log('INFO', 'INFINITEPAY', 'Webhook recebido', { orderNsu, paid, capture_method: raw?.capture_method });

    // Se o pedido tem comprador registrado no servidor → envia comprovante no WhatsApp dele
    if (orderNsu) {
      const buyer = lerCompradores()[orderNsu];
      if (buyer && buyer.telefone) {
        if (!paid) {
          log('INFO', 'WHATSAPP', 'Cobrança ainda não confirmada; aguardando webhook de confirmação', { orderNsu });
        } else {
          const r = await enviarMensagensPagamentoConfirmado(orderNsu, buyer, raw);
          // Só remove o registro se o comprovante saiu; senão devolve 500 p/ a Infinite reenviar o webhook
          if (!r.ok) {
            log('WARN', 'WHATSAPP', 'Comprovante NÃO enviado (WhatsApp falhou) — mantendo registro para retry', { orderNsu });
            return sendJson(res, 500, { received: false, provider: 'infinitepay', orderNsu, retry: true });
          }
          removerComprador(orderNsu);
        }
      } else {
        log('DEBUG', 'INFINITEPAY', 'Webhook de pedido sem comprador registrado no servidor', { orderNsu });
      }
    }
    return sendJson(res, 200, { received: true, provider: 'infinitepay', orderNsu });
  }
  // POST /api/whatsapp (registra número oficial)
  if (caminho === '/api/whatsapp' && req.method === 'POST') {
    const body = await readBody(req);
    if (typeof body.whatsapp === 'string' && /^\d{10,15}$/.test(body.whatsapp)) {
      salvarConfig({ whatsappNotif: body.whatsapp });
      log('INFO', 'WHATSAPP', 'Número oficial atualizado', { wa: body.whatsapp });
      return sendJson(res, 200, { ok: true, whatsappNotif: body.whatsapp });
    }
    return sendJson(res, 400, { error: 'Número inválido' });
  }
  // GET /api/whatsapp/status
  if (caminho === '/api/whatsapp/status' && req.method === 'GET') {
    return sendJson(res, 200, { ...WA.getStatus() });
  }
  // GET /api/whatsapp/mensagens — histórico de mensagens enviadas pelo sistema
  if (caminho === '/api/whatsapp/mensagens' && req.method === 'GET') {
    let limite = 100;
    try {
      const q = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams;
      limite = Math.min(parseInt(q.get('limite') || '100', 10) || 100, 500);
    } catch { /* usa padrão */ }
    return sendJson(res, 200, { mensagens: WA.getHistoricoMensagens(limite) });
  }
  // GET /api/whatsapp/qrcode — pré-requisito visual para o pareamento por QR
  // O próprio navegador pede este endpoint a cada poucos segundos enquanto o admin estiver aberto;
  // o QR chega via connection.update do Baileys assim que a sessão não registrada abre o WebSocket.
   if (caminho === '/api/whatsapp/qrcode' && req.method === 'GET') {
     // Fix 2026-08-09b: prepararQr() é idempotente e NÃO destrói o QR a cada poll.
     // (O bug anterior chamava limparSessao() a cada 4s → "QR refs attempts ended".)
     if (!WA.getStatus().pareado) WA.prepararQr();
     const st = WA.getStatus();
     const ret = { pareado: st.pareado, ownerPhone: st.ownerPhone, error: st.error };
     if (st.qr) ret.qr = st.qr;
     return sendJson(res, 200, ret);
   }
  // GET /api/whatsapp/qrcode/png — desenha o QR como imagem (o admin mostra direto)
    if (caminho === '/api/whatsapp/qrcode/png' && req.method === 'GET') {
      let st = WA.getStatus();
      if (st.pareado) return sendJson(res, 200, { pareado: true });
      // Fix 2026-08-09b: idempotente — não destrói o QR ativo a cada request
      WA.prepararQr();
      st = WA.getStatus();
      if (!st.qr) return sendJson(res, 202, { error: 'Aguardando QR... tente de novo em 2s', pareado: false });
    try {
      const QRCode = (await import('qrcode')).default;
      const buf = await QRCode.toBuffer(st.qr, { width: 560, margin: 2 });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      res.end(buf);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }
  // POST /api/whatsapp/parear — gera código de pareamento para o celular do dono
  if (caminho === '/api/whatsapp/parear' && req.method === 'POST') {
    const body = await readBody(req);
    const num = body.numero || body.whatsapp || '';
    const r = await WA.gerarCodigoPareamento(String(num));
    log(r.ok ? 'INFO' : 'ERROR', 'WHATSAPP', 'Pareamento solicitado', { phone: num, ok: r.ok });
    return sendJson(res, r.ok ? 200 : 400, r);
  }
  // POST /api/whatsapp/enviar — envia mensagem (sessão pareada do dono)
  if (caminho === '/api/whatsapp/enviar' && req.method === 'POST') {
    const body = await readBody(req);
    const numero = body.numero || body.para || '';
    const texto = body.texto || body.mensagem || '';
    if (!numero || !texto) return sendJson(res, 400, { error: 'Informe numero e texto' });
    try {
      const r = await WA.enviarSeguro(String(numero), String(texto));
      if (r.notPaired) return sendJson(res, 409, { error: 'WhatsApp não pareado. Pare o aparelho do dono no painel.', notPaired: true });
      if (!r.ok) return sendJson(res, 500, { error: r.error || 'Falha no envio' });
      return sendJson(res, 200, r);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }
  return sendJson(res, 404, { error: 'Rota não encontrada' });
}

// ── Servidor ──
const server = http.createServer((req, res) => {
  // Defesa: URL malformada (ex.: path '//' enviado por crawlers/cloudflared)
  // não pode derrubar o processo inteiro. Tratado em 2026-08-09 (ERR_INVALID_URL).
  let caminho = '/';
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    caminho = u.pathname.replace(/\/+/g, '/');
  } catch {
    log('WARN', 'SERVER', 'Request com URL inválida', { url: String(req.url).slice(0, 200) });
  }
  if (caminho.startsWith('/api/')) {
    handleApi(req, res, caminho).catch(err => { log('ERROR', 'API', 'Falha na rota', { error: err.message }); sendJson(res, 500, { error: err.message }); });
    return;
  }
  servirEstatico(req, res, caminho);
});

// Tratamento de erros de inicialização do servidor (ex: porta ocupada)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log('ERROR', 'SERVER', `Porta ${PORT} já está em uso por outro processo`, { porta: PORT });
    console.error(`\n❌ [ERRO DE INICIALIZAÇÃO] A porta ${PORT} já está ocupada por outro processo!`);
    console.error(`👉 Para liberar a porta ocupada, execute no terminal:\n   fuser -k ${PORT}/tcp  (ou npm run clean:port)`);
    console.error(`👉 Ou inicie o servidor em outra porta:\n   node server.mjs ${PORT + 1}  (ou PORT=${PORT + 1} npm start)\n`);
    process.exit(1);
  } else {
    log('ERROR', 'SERVER', 'Erro no servidor HTTP', { error: err.message, code: err.code });
    console.error(`\n❌ [ERRO NO SERVIDOR] ${err.message}\n`);
    process.exit(1);
  }
});

// Graceful Shutdown (encerramento limpo de conexões)
function shutdown(signal) {
  log('INFO', 'SERVER', `Recebido sinal ${signal}. Encerrando servidor de forma graciosa...`);
  server.close(() => {
    log('INFO', 'SERVER', 'Servidor HTTP finalizado com sucesso.');
    process.exit(0);
  });
  setTimeout(() => {
    log('WARN', 'SERVER', 'Forçando encerramento após tempo limite.');
    process.exit(1);
  }, 4000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  log('ERROR', 'PROCESS', 'Exceção não tratada capturada', { error: err.message, stack: err.stack });
  console.error('[ERRO NÃO TRATADO]', err);
});

process.on('unhandledRejection', (reason) => {
  log('ERROR', 'PROCESS', 'Promise rejeitada não tratada capturada', { reason: String(reason) });
  console.error('[PROMISE REJEITADA]', reason);
});

server.listen(PORT, () => {
  log('INFO', 'SERVER', `Pizzaria rodando em http://localhost:${PORT}`);
  console.log(`\n🍕 Pizzaria do Rocha — Servidor HTTP online em http://localhost:${PORT}`);
  console.log(`📌 Painel Administrativo Oculto: http://localhost:${PORT}/ad\n`);
  // Inicia a sessão do WhatsApp Web (Baileys) em background para reconectar sessão salva
  WA.iniciarBackground();
});

export { server };
