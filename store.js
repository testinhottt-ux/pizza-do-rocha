// store.js — Camada de dados da Pizzaria do Rocha (VANILLA, sem dependências).
// Persistência: localStorage. Usado por todas as páginas via <script type="module">.

const KEY = 'pizzariaRochaDB';
const MENU_VERSION = 8;
// A senha real do painel vive SOMENTE no servidor (ADMIN_PASS / POST /api/admin/login).
// O que sobra aqui é só um resumo (FNV-1a) — não permite recuperar a senha original.
const ADMIN_PASS_HASH = '7481eb56';

const STATUS_FLOW = ['recebido', 'preparando', 'forno', 'saiu_entrega', 'entregue'];
const STATUS_LABELS = {
  recebido: 'Pedido recebido',
  preparando: 'Preparando',
  forno: 'No forno',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

// ---- Contato oficial ----
export const CONTATO = {
  nome: 'Pizzaria do Rocha',
  telefone: '(31) 99186-7625',
  telefoneDigits: '5531991867625',
  whatsapp: 'https://wa.me/5531991867625',
  whatsappMsg: 'https://wa.me/5531991867625?text=' +
    encodeURIComponent('Olá! Gostaria de fazer um pedido na Pizzaria do Rocha.'),
  endereco: '',
  enderecoCurto: '',
  mapsUrl: '',
  mapEmbed: '',
  horario: 'Todos os dias · 18h às 21h',
  entrega: 'Entrega rápida · peça pelo site ou WhatsApp',
};

// ---- Fotos ilustrativas (baixadas em ./images) ----
export const FOTOS = {
  hero: 'images/hero-forno.jpg',
  historia: 'images/pizza-meio-salaminho-lombinho.jpg',
  generica: 'images/pizza-mussarela-artesanal.jpg',
  galeria: [
    'images/pizza-margherita.jpg',
    'images/pizza-calabresa.jpg',
    'images/pizza-portuguesa.jpg',
    'images/pizza-frango.jpg',
    'images/pizza-mussarela-artesanal.jpg',
    'images/pizza-especial-rocha.jpg',
    'images/pizza-meio-salaminho-lombinho.jpg',
  ],
};

const FOTO_KEYWORDS = [
  [/salaminho|lombinho/i, 'images/pizza-meio-salaminho-lombinho.jpg'],
  [/marg|mussar|muçar|queijo|napolit/i, 'images/pizza-margherita.jpg'],
  [/pepper|peperoni|pepperoni/i, 'images/pizza-pepperoni.jpg'],
  [/calabr|lingu|bacon/i, 'images/pizza-calabresa.jpg'],
  [/quatro|4 queijo|4queijo|especial|premium|teste/i, 'images/pizza-especial-rocha.jpg'],
  [/portug|lombo|presunto|ovo/i, 'images/pizza-portuguesa.jpg'],
  [/frango|catupiry|chicken/i, 'images/pizza-frango.jpg'],
  // Bebidas (fotos reais de alta resolução nível Awwwards)
  [/col(a|a)|refrigerante|fanta|sprite|pepsi|lata/i, 'images/coca-cola-2l.jpg'],
  [/guaran[aá]|antarctica/i, 'images/guarana-antarctica-2l.jpg'],
];

export function photoFor(nome, categoria, foto) {
  if (foto) return foto; // foto explícita do cadastro tem prioridade
  const alvo = `${nome || ''} ${categoria || ''}`;
  for (const [re, url] of FOTO_KEYWORDS) if (re.test(alvo)) return url;
  const base = String(nome || '');
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  return FOTOS.galeria[hash % FOTOS.galeria.length];
}

// ---- Seed: pizzas iniciais (só na primeira vez) ----
function seedItems() {
  const base = [
    ['Portuguesa (à moda) · Média', 'Pizza média · 30 cm · 6 pedaços', 49.99, 'Molho, presunto, cebola, pimentão, bacon, tomate, ovos, muçarela, queijo parmesão ralado, azeitona e orégano.', 'images/pizza-portuguesa.jpg'],
    ['Portuguesa (à moda) · Gigante', 'Pizza gigante · 35 cm · 8 pedaços', 59.99, 'Molho, presunto, cebola, pimentão, bacon, tomate, ovos, muçarela, queijo parmesão ralado, azeitona e orégano.', 'images/pizza-portuguesa.jpg'],
    ['Calabresa · Média', 'Pizza média · 30 cm · 6 pedaços', 49.99, 'Molho, frango desfiado, muçarela, calabresa desfiada, cebola, queijo parmesão ralado e orégano.', 'images/pizza-calabresa.jpg'],
    ['Calabresa · Gigante', 'Pizza gigante · 35 cm · 8 pedaços', 59.99, 'Molho, frango desfiado, muçarela, calabresa desfiada, cebola, queijo parmesão ralado e orégano.', 'images/pizza-calabresa.jpg'],
    ['Presunto com muçarela · Média', 'Pizza média · 30 cm · 6 pedaços', 49.99, 'Molho de tomate, presunto, bacon, tomate, cebola, muçarela, queijo parmesão e orégano.', 'images/pizza-mussarela-artesanal.jpg'],
    ['Presunto com muçarela · Gigante', 'Pizza gigante · 35 cm · 8 pedaços', 59.99, 'Molho de tomate, presunto, bacon, tomate, cebola, muçarela, queijo parmesão e orégano.', 'images/pizza-mussarela-artesanal.jpg'],
    ['Marguerita · Média', 'Pizza média · 30 cm · 6 pedaços', 49.99, 'Molho, muçarela, tomate, manjericão, queijo ralado e orégano.', 'images/pizza-margherita.jpg'],
    ['Marguerita · Gigante', 'Pizza gigante · 35 cm · 8 pedaços', 59.99, 'Molho, muçarela, tomate, manjericão, queijo ralado e orégano.', 'images/pizza-margherita.jpg'],
    ['1/2 Salaminho e 1/2 Lombinho Canadense · Média', 'Pizza média · 30 cm · 6 pedaços', 49.99, 'Metade salaminho especial com muçarela e orégano, metade lombinho canadense fatiado com queijo e temperos da casa.', 'images/pizza-meio-salaminho-lombinho.jpg'],
    ['1/2 Salaminho e 1/2 Lombinho Canadense · Gigante', 'Pizza gigante · 35 cm · 8 pedaços', 59.99, 'Metade salaminho especial com muçarela e orégano, metade lombinho canadense fatiado com queijo e temperos da casa.', 'images/pizza-meio-salaminho-lombinho.jpg'],
    ['Pizza de Teste (Compra Real)', 'Pizza Broto · 20 cm · 4 pedaços', 1.00, 'Pizza especial de teste para validação de compras reais via PIX e Cartão InfinitePay.', 'images/pizza-especial-rocha.jpg'],
  ];
  return base.map(([nome, categoria, preco, descricao, foto], i) => ({
    id: 'propaganda_' + i,
    nome, categoria, preco, descricao, foto,
    estoque: 999, ativo: true,
    destaque: i === 0 || i === 1 || i === 8 || i === 10, // Destaques iniciais da Home
  }));
}

// ---- Seed: bebidas iniciais (entram junto do cardápio na primeira vez / migração) ----
function seedBebidas() {
  const base = [
    ['Coca-Cola · 2 Litros', 'Bebidas · 2 Litros', 13.99, 'Refrigerante Coca-Cola 2 litros gelado, ideal para acompanhar sua pizza.', 'images/coca-cola-2l.jpg', 120],
    ['Guaraná Antarctica · 2 Litros', 'Bebidas · 2 Litros', 13.99, 'Refrigerante Guaraná Antarctica 2 litros gelado, sabor original.', 'images/guarana-antarctica-2l.jpg', 120],
  ];
  return base.map(([nome, categoria, preco, descricao, foto, estoque], i) => ({
    id: 'bebida_propaganda_' + i,
    nome, categoria, preco, descricao, foto,
    estoque, ativo: true,
    destaque: false,
  }));
}

function defaultDB() {
  return { items: [...seedItems(), ...seedBebidas()], orders: [], cart: [], seeded: true, menuVersion: MENU_VERSION };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const db = defaultDB(); save(db); return db; }
    const db = JSON.parse(raw);
    if (db.menuVersion !== MENU_VERSION) {
      // Migração: remove água e suco, adiciona novos itens do seed e atualiza bebidas para 2 Litros a R$ 13,99 com fotos reais
      let atuais = (db.items || []).filter(i => !/[áa]gua|mineral|suco/i.test(i?.nome || '') && !/[áa]gua|mineral|suco/i.test(i?.descricao || ''));
      
      // Atualiza refrigerantes existentes para 2 Litros, R$ 13,99 e fotos reais
      atuais = atuais.map(i => {
        if (/coca/i.test(i?.nome || '')) {
          return {
            ...i,
            nome: 'Coca-Cola · 2 Litros',
            categoria: 'Bebidas · 2 Litros',
            preco: 13.99,
            foto: 'images/coca-cola-2l.jpg',
            descricao: 'Refrigerante Coca-Cola 2 litros gelado, ideal para acompanhar sua pizza.'
          };
        }
        if (/guaran[aá]/i.test(i?.nome || '')) {
          return {
            ...i,
            nome: 'Guaraná Antarctica · 2 Litros',
            categoria: 'Bebidas · 2 Litros',
            preco: 13.99,
            foto: 'images/guarana-antarctica-2l.jpg',
            descricao: 'Refrigerante Guaraná Antarctica 2 litros gelado, sabor original.'
          };
        }
        return i;
      });

      // Adiciona itens do seed que ainda não existem
      const todosSeeds = [...seedItems(), ...seedBebidas()];
      const novos = todosSeeds.filter(s => !atuais.some(i => i?.nome === s.nome));
      
      const migrated = { ...db, items: [...atuais, ...novos], seeded: true, menuVersion: MENU_VERSION };
      save(migrated);
      return migrated;
    }
    return { items: db.items || [], orders: db.orders || [], cart: db.cart || [], seeded: db.seeded, menuVersion: db.menuVersion };
  } catch (e) {
    return defaultDB();
  }
}

function save(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---- Itens de cardápio ----
export function getItems() { return load().items; }

export function getItem(id) {
  return getItems().find((i) => i.id === id) || null;
}

export function getDestaques() {
  const items = getItems().filter((i) => i.ativo !== false);
  const marcados = items.filter((i) => i.destaque === true);
  return marcados.length > 0 ? marcados : items.slice(0, 3);
}

export function toggleDestaque(id) {
  const db = load();
  const item = db.items.find((i) => i.id === id);
  if (item) {
    item.destaque = !item.destaque;
    save(db);
  }
  return item;
}

export function saveItem(item) {
  const db = load();
  if (item.id) {
    const idx = db.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      const anterior = db.items[idx];
      db.items[idx] = { ...anterior, ...item };
    } else {
      db.items.push(item);
    }
  } else {
    item.id = uid('item');
    db.items.push(item);
  }
  save(db);
  return item;
}

export function deleteItem(id) {
  const db = load();
  db.items = db.items.filter((i) => i.id !== id);
  db.cart = db.cart.filter((c) => c.itemId !== id);
  save(db);
}

export function adjustStock(id, delta) {
  const db = load();
  const item = db.items.find((i) => i.id === id);
  if (item) item.estoque = Math.max(0, (item.estoque || 0) + delta);
  save(db);
  return item;
}

// ---- Carrinho ----
export function getCart() {
  const db = load();
  return db.cart.map((c) => {
    const item = db.items.find((i) => i.id === c.itemId);
    return item ? { ...c, item } : null;
  }).filter(Boolean);
}

export function addToCart(itemId, qtd = 1) {
  const db = load();
  const line = db.cart.find((c) => c.itemId === itemId);
  if (line) line.qtd += qtd; else db.cart.push({ itemId, qtd });
  save(db);
}

export function setCartQty(itemId, qtd) {
  const db = load();
  if (qtd <= 0) db.cart = db.cart.filter((c) => c.itemId !== itemId);
  else { const line = db.cart.find((c) => c.itemId === itemId); if (line) line.qtd = qtd; }
  save(db);
}

export function removeFromCart(itemId) {
  const db = load();
  db.cart = db.cart.filter((c) => c.itemId !== itemId);
  save(db);
}

export function clearCart() { const db = load(); db.cart = []; save(db); }

export function cartCount() { return load().cart.reduce((s, c) => s + c.qtd, 0); }

export function cartTotal() {
  const sum = getCart().reduce((s, c) => s + c.qtd * (c.item.preco || 0), 0);
  return Math.round(sum * 100) / 100;
}

// ---- Pedidos ----
export function getOrders() {
  return load().orders.slice().sort((a, b) => b.criadoEm - a.criadoEm);
}

export function getOrder(id) { return load().orders.find((o) => o.id === id); }

// id/numero são opcionais: quando o servidor registra o pedido, ele manda os dele
// para que cliente e painel do dono falem do MESMO pedido.
export function createOrder({ cliente, pagamento, id, numero }) {
  const db = load();
  const cartLines = db.cart.map((c) => {
    const item = db.items.find((i) => i.id === c.itemId);
    return item ? { itemId: c.itemId, nome: item.nome, qtd: c.qtd, preco: item.preco } : null;
  }).filter(Boolean);
  const total = Math.round(cartLines.reduce((s, l) => s + l.qtd * l.preco, 0) * 100) / 100;
  const order = {
    id: id || uid('ped'),
    numero: Number(numero) || Math.floor(1000 + Math.random() * 9000),
    itens: cartLines, total, cliente, pagamento,
    status: 'recebido', criadoEm: Date.now(),
  };
  cartLines.forEach((l) => {
    const item = db.items.find((i) => i.id === l.itemId);
    if (item) item.estoque = Math.max(0, (item.estoque || 0) - l.qtd);
  });
  db.orders.push(order);
  db.cart = [];
  save(db);
  return order;
}

export function updateOrderStatus(id, status) {
  const db = load();
  const order = db.orders.find((o) => o.id === id);
  if (order) order.status = status;
  save(db);
  return order;
}

// Mescla campos vindos do servidor (status, total, pagamento) num pedido local.
export function patchOrder(id, patch = {}) {
  const db = load();
  const order = db.orders.find((o) => o.id === id);
  if (order) Object.assign(order, patch);
  save(db);
  return order;
}

// Vincula/atualiza os dados de pagamento de um pedido (providerPaymentId, status, simulacao)
export function setOrderPayment(id, patch = {}) {
  const db = load();
  const order = db.orders.find((o) => o.id === id);
  if (order) {
    order.pagamento = { ...(order.pagamento || {}), ...patch };
  }
  save(db);
  return order;
}

// ---- Status ----
export function nextStatus(status) {
  const idx = STATUS_FLOW.indexOf(status);
  if (idx < 0 || idx === STATUS_FLOW.length - 1) return status;
  return STATUS_FLOW[idx + 1];
}
export function statusLabel(status) { return STATUS_LABELS[status] || status; }
export function statusFlow() { return STATUS_FLOW.slice(); }

// ---- Admin ----
// Conferência local apenas para feedback imediato na tela; quem realmente autoriza
// as rotas /api/pedidos é o servidor, comparando com ADMIN_PASS.
function hashSenha(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
export function checkAdminPass(pass) { return hashSenha(String(pass ?? '')) === ADMIN_PASS_HASH; }

// ---- Helpers de formatação ----
export function money(n) { return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ','); }

export function formatarTelefone(numero) {
  if (!numero) return '';
  const digits = String(numero).replace(/\D/g, '');
  if (!digits) return '';
  let d = digits;
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    d = d.slice(2);
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (d.length === 9) {
    return `${d.slice(0, 5)}-${d.slice(5)}`;
  }
  if (d.length === 8) {
    return `${d.slice(0, 4)}-${d.slice(4)}`;
  }
  return digits;
}

export function updateContatoTelefone(novoNumero) {
  if (!novoNumero) return CONTATO;
  const digits = String(novoNumero).replace(/\D/g, '').replace(/^0/, '');
  if (!digits) return CONTATO;
  const full = digits.startsWith('55') ? digits : '55' + digits;
  CONTATO.telefoneDigits = full;
  CONTATO.telefone = formatarTelefone(digits);
  CONTATO.whatsapp = `https://wa.me/${full}`;
  CONTATO.whatsappMsg = `https://wa.me/${full}?text=` +
    encodeURIComponent('Olá! Gostaria de fazer um pedido na Pizzaria do Rocha.');
  return CONTATO;
}

// ---- Sincronização de Cardápio com o Servidor (Multi-Usuários) ----
export async function syncCardapioComServidor() {
  if (typeof fetch === 'undefined') return getItems();
  try {
    const res = await fetch('/api/cardapio', { cache: 'no-store' });
    if (!res.ok) return getItems();
    const data = await res.json();
    if (data && Array.isArray(data.items) && data.items.length > 0) {
      const db = load();
      db.items = data.items;
      db.menuVersion = MENU_VERSION;
      save(db);
      return db.items;
    }
  } catch (e) {
    // Offline / fallback local
  }
  return getItems();
}

export async function saveItemNoServidor(item, adminPass) {
  const localSaved = saveItem(item);
  let serverOk = false;
  let serverError = null;

  if (typeof fetch !== 'undefined') {
    try {
      const pass = adminPass || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_pass') : '');
      const headers = { 'Content-Type': 'application/json' };
      if (pass) headers['x-admin-pass'] = pass;
      const res = await fetch('/api/cardapio/item', {
        method: 'POST',
        headers,
        body: JSON.stringify({ item: localSaved })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.items) {
          const db = load();
          db.items = data.items;
          save(db);
        }
        serverOk = true;
      } else {
        const errJson = await res.json().catch(() => ({}));
        serverError = errJson.error || `HTTP ${res.status}`;
      }
    } catch (e) {
      serverError = e.message;
    }
  }
  return { ok: serverOk, item: localSaved, error: serverError };
}

export async function deleteItemNoServidor(id, adminPass) {
  deleteItem(id);
  let serverOk = false;
  let serverError = null;

  if (typeof fetch !== 'undefined') {
    try {
      const pass = adminPass || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_pass') : '');
      const headers = {};
      if (pass) headers['x-admin-pass'] = pass;
      const res = await fetch(`/api/cardapio/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.items) {
          const db = load();
          db.items = data.items;
          save(db);
        }
        serverOk = true;
      } else {
        const errJson = await res.json().catch(() => ({}));
        serverError = errJson.error || `HTTP ${res.status}`;
      }
    } catch (e) {
      serverError = e.message;
    }
  }
  return { ok: serverOk, error: serverError };
}


