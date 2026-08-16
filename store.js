// store.js — Camada de dados da Pizzaria do Rocha (VANILLA, sem dependências).
// Persistência: localStorage. Usado por todas as páginas via <script type="module">.

const KEY = 'pizzariaRochaDB';
const MENU_VERSION = 4;
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
  telefone: '(99) 91867-625',
  telefoneDigits: '559991867625',
  whatsapp: 'https://wa.me/559991867625',
  whatsappMsg: 'https://wa.me/559991867625?text=' +
    encodeURIComponent('Olá! Gostaria de fazer um pedido na Pizzaria do Rocha.'),
  endereco: '',
  enderecoCurto: '',
  mapsUrl: '',
  mapEmbed: '',
  horario: 'Todos os dias · 18h às 21h',
  entrega: 'Entrega rápida · peça pelo WhatsApp ou iFood',
};

// ---- Fotos ilustrativas (baixadas em ./images) ----
export const FOTOS = {
  hero: 'images/hero-forno.jpg',
  historia: 'images/historia-pizzaiolo.jpg',
  generica: 'images/pizza-generica.jpg',
  galeria: [
    'images/pizza-margherita.jpg',
    'images/pizza-pepperoni.jpg',
    'images/pizza-calabresa.jpg',
    'images/pizza-quatro.jpg',
    'images/pizza-portuguesa.jpg',
    'images/pizza-frango.jpg',
  ],
};

const FOTO_KEYWORDS = [
  [/marg|mussar|muçar|queijo|napolit/i, 'images/pizza-margherita.jpg'],
  [/pepper|peperoni|pepperoni/i, 'images/pizza-pepperoni.jpg'],
  [/calabr|lingu|bacon/i, 'images/pizza-calabresa.jpg'],
  [/quatro|4 queijo|4queijo|especial|premium/i, 'images/pizza-quatro.jpg'],
  [/portug|lombo|presunto|ovo/i, 'images/pizza-portuguesa.jpg'],
  [/frango|catupiry|chicken/i, 'images/pizza-frango.jpg'],
  // Bebidas (imagens ilustrativas em ./images, sempre marcadas como "Ilustrativa" na UI)
  [/col(a|a)|refrigerante|fanta|sprite|pepsi|cerveja|lata/i, 'images/bebida-cola.svg'],
  [/guaran[aá]|antarctica|schin/i, 'images/bebida-guarana.svg'],
  [/suco|laranja|maracuj[aá]|abacaxi|natural/i, 'images/bebida-suco.svg'],
  [/[áa]gua|mineral|garrafa|h2o/i, 'images/bebida-agua.svg'],
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
    ['Presunto com muçarela · Média', 'Pizza média · 30 cm · 6 pedaços', 49.99, 'Molho de tomate, presunto, bacon, tomate, cebola, muçarela, queijo parmesão e orégano.', 'images/pizza-generica.jpg'],
    ['Presunto com muçarela · Gigante', 'Pizza gigante · 35 cm · 8 pedaços', 59.99, 'Molho de tomate, presunto, bacon, tomate, cebola, muçarela, queijo parmesão e orégano.', 'images/pizza-generica.jpg'],
    ['Marguerita · Média', 'Pizza média · 30 cm · 6 pedaços', 49.99, 'Molho, muçarela, tomate, manjericão, queijo ralado e orégano.', 'images/pizza-margherita.jpg'],
    ['Marguerita · Gigante', 'Pizza gigante · 35 cm · 8 pedaços', 59.99, 'Molho, muçarela, tomate, manjericão, queijo ralado e orégano.', 'images/pizza-margherita.jpg'],
  ];
  return base.map(([nome, categoria, preco, descricao, foto], i) => ({
    id: 'propaganda_' + i,
    nome, categoria, preco, descricao, foto,
    estoque: 999, ativo: true,
  }));
}

// ---- Seed: bebidas iniciais (entram junto do cardápio na primeira vez / migração) ----
function seedBebidas() {
  const base = [
    ['Coca-Cola Lata 350ml', 'Bebidas', 6.0, 'Refrigerante de cola gelado · lata 350 ml.', 'images/bebida-cola.svg', 120],
    ['Guaraná Antarctica Lata 350ml', 'Bebidas', 5.5, 'Refrigerante de guaraná gelado · lata 350 ml.', 'images/bebida-guarana.svg', 120],
    ['Suco de Laranja Natural 500ml', 'Bebidas', 8.0, 'Suco de laranja natural, gelado · copo 500 ml.', 'images/bebida-suco.svg', 60],
    ['Água Mineral 500ml', 'Bebidas', 4.0, 'Água mineral sem gás · garrafa 500 ml.', 'images/bebida-agua.svg', 100],
  ];
  return base.map(([nome, categoria, preco, descricao, foto, estoque], i) => ({
    id: 'bebida_propaganda_' + i,
    nome, categoria, preco, descricao, foto,
    estoque, ativo: true,
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
      // Migração NÃO destrói o cardápio customizado nem os pedidos:
      // mantém os itens atuais e apenas adiciona bebidas que ainda não existem.
      const atuais = db.items || [];
      const sobrando = seedBebidas().filter(b => !atuais.some(i => i?.nome === b.nome));
      const migrated = { ...db, items: [...atuais, ...sobrando], seeded: true, menuVersion: MENU_VERSION };
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

export function saveItem(item) {
  const db = load();
  if (item.id) {
    const idx = db.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) db.items[idx] = item; else db.items.push(item);
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
  return getCart().reduce((s, c) => s + c.qtd * (c.item.preco || 0), 0);
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
  const total = cartLines.reduce((s, l) => s + l.qtd * l.preco, 0);
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
