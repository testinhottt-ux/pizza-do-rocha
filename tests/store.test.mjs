// Testes unitários do store.js (Pizzaria do Rocha)
// Framework: node:test embutido (sem dependências externas).
// Rodar:  node --test tests/   (a partir da raiz do projeto)
//
// store.js usa `localStorage` como global. Criamos um mock em memória ANTES
// de importar o módulo, já que as chamadas a localStorage acontecem dentro
// das funções (lazy), não no top-level.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---- Mock de localStorage em memória ----
class LocalStorageMock {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.has(k) ? this.store.get(k) : null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}
globalThis.localStorage = new LocalStorageMock();

// Import dinâmico depois do mock estar pronto.
const store = await import('../store.js');

beforeEach(() => {
  globalThis.localStorage.clear();
});

// Helper: cadastra uma pizza e devolve o item salvo.
function seedPizza(over = {}) {
  return store.saveItem({
    nome: 'Margherita', categoria: 'Tradicionais', preco: 45.9,
    descricao: 'Molho, muçarela e manjericão', estoque: 10, ativo: true, ...over,
  });
}

// ============ ITENS DE CARDÁPIO ============

test('getItems retorna 12 itens seedados no início', () => {
  const items = store.getItems();
  assert.equal(items.length, 12, 'Deve ter 12 itens no cardápio inicial (8 pizzas + 4 bebidas)');
});

test('saveItem cria item novo com id gerado', () => {
  const countBefore = store.getItems().length;
  const it = seedPizza();
  assert.ok(it.id, 'id deve ser gerado');
  assert.equal(store.getItems().length, countBefore + 1);
  const found = store.getItems().find(i => i.id === it.id);
  assert.equal(found?.nome, 'Margherita');
});

test('saveItem atualiza item existente (mesmo id, sem duplicar)', () => {
  const it = seedPizza();
  const countBefore = store.getItems().length;
  store.saveItem({ ...it, preco: 50 });
  const items = store.getItems();
  assert.equal(items.length, countBefore, 'não deve duplicar');
  const found = items.find(i => i.id === it.id);
  assert.equal(found?.preco, 50);
});

test('deleteItem remove o item e limpa do carrinho', () => {
  const it = seedPizza();
  const countBefore = store.getItems().length;
  store.addToCart(it.id, 2);
  store.deleteItem(it.id);
  assert.equal(store.getItems().length, countBefore - 1);
  assert.equal(store.getCart().length, 0, 'linha do carrinho órfã deve sumir');
});

test('adjustStock nunca deixa estoque negativo', () => {
  const it = seedPizza({ estoque: 2 });
  store.adjustStock(it.id, -5);
  const itemZero = store.getItems().find(i => i.id === it.id);
  assert.equal(itemZero?.estoque, 0);
  store.adjustStock(it.id, 3);
  const itemTres = store.getItems().find(i => i.id === it.id);
  assert.equal(itemTres?.estoque, 3);
});

// ============ CARRINHO ============

test('addToCart soma quantidade da mesma linha', () => {
  const it = seedPizza();
  store.addToCart(it.id, 1);
  store.addToCart(it.id, 2);
  const cart = store.getCart();
  assert.equal(cart.length, 1);
  assert.equal(cart[0].qtd, 3);
});

test('setCartQty ajusta e remove quando qtd <= 0', () => {
  const it = seedPizza();
  store.addToCart(it.id, 5);
  store.setCartQty(it.id, 2);
  assert.equal(store.getCart()[0].qtd, 2);
  store.setCartQty(it.id, 0);
  assert.equal(store.getCart().length, 0);
});

test('cartCount e cartTotal calculam corretamente', () => {
  const a = seedPizza({ nome: 'A', preco: 10 });
  const b = seedPizza({ nome: 'B', preco: 20 });
  store.addToCart(a.id, 2); // 20
  store.addToCart(b.id, 1); // 20
  assert.equal(store.cartCount(), 3);
  assert.equal(store.cartTotal(), 40);
});

test('getCart ignora linhas cujo item foi apagado', () => {
  const it = seedPizza();
  store.addToCart(it.id, 1);
  // apaga o item direto no DB simulando inconsistência
  const raw = JSON.parse(globalThis.localStorage.getItem('pizzariaRochaDB'));
  raw.items = [];
  globalThis.localStorage.setItem('pizzariaRochaDB', JSON.stringify(raw));
  assert.deepEqual(store.getCart(), []);
});

test('clearCart esvazia o carrinho', () => {
  const it = seedPizza();
  store.addToCart(it.id, 3);
  store.clearCart();
  assert.equal(store.cartCount(), 0);
});

// ============ PEDIDOS ============

test('createOrder cria pedido, baixa estoque e limpa carrinho', () => {
  const it = seedPizza({ estoque: 10, preco: 30 });
  store.addToCart(it.id, 2);
  const order = store.createOrder({
    cliente: { nome: 'João', telefone: '3199999', endereco: 'Rua Hait 155' },
    pagamento: { metodo: 'pix', status: 'aprovado' },
  });
  assert.equal(order.total, 60);
  assert.equal(order.status, 'recebido');
  assert.ok(order.numero >= 1000 && order.numero <= 9999);
  const itemAtualizado = store.getItems().find(i => i.id === it.id);
  assert.equal(itemAtualizado?.estoque, 8, 'estoque deve baixar 2');
  assert.equal(store.cartCount(), 0, 'carrinho deve limpar');
});

test('getOrders ordena do mais recente para o mais antigo', () => {
  const it = seedPizza();
  store.addToCart(it.id, 1);
  const o1 = store.createOrder({ cliente: { nome: 'A' }, pagamento: {} });
  store.addToCart(it.id, 1);
  const o2 = store.createOrder({ cliente: { nome: 'B' }, pagamento: {} });
  // Dois createOrder podem cair no mesmo milissegundo (Date.now()), o que torna
  // a ordenação por criadoEm empatada. Forçamos timestamps distintos para
  // validar a REGRA de ordenação (mais recente primeiro) de forma determinística.
  const raw = JSON.parse(globalThis.localStorage.getItem('pizzariaRochaDB'));
  raw.orders.forEach((o) => { o.criadoEm = o.id === o1.id ? 1000 : 2000; });
  globalThis.localStorage.setItem('pizzariaRochaDB', JSON.stringify(raw));
  const orders = store.getOrders();
  assert.equal(orders[0].id, o2.id, 'mais recente primeiro');
  assert.equal(orders[1].id, o1.id);
});

test('getOrder recupera pedido por id', () => {
  const it = seedPizza();
  store.addToCart(it.id, 1);
  const o = store.createOrder({ cliente: { nome: 'A' }, pagamento: {} });
  assert.equal(store.getOrder(o.id).id, o.id);
  assert.equal(store.getOrder('inexistente'), undefined);
});

// ============ FLUXO DE STATUS ============

test('nextStatus avança na sequência e trava no último', () => {
  assert.equal(store.nextStatus('recebido'), 'preparando');
  assert.equal(store.nextStatus('forno'), 'saiu_entrega');
  assert.equal(store.nextStatus('entregue'), 'entregue');
  assert.equal(store.nextStatus('desconhecido'), 'desconhecido');
});

test('updateOrderStatus altera o status do pedido', () => {
  const it = seedPizza();
  store.addToCart(it.id, 1);
  const o = store.createOrder({ cliente: { nome: 'A' }, pagamento: {} });
  store.updateOrderStatus(o.id, 'forno');
  assert.equal(store.getOrder(o.id).status, 'forno');
});

test('statusLabel devolve rótulo legível', () => {
  assert.equal(store.statusLabel('saiu_entrega'), 'Saiu para entrega');
  assert.equal(store.statusLabel('entregue'), 'Entregue');
});

// ============ CONTATO E FOTOS (novos) ============

test('CONTATO tem telefone, whatsapp e endereço corretos', () => {
  assert.equal(store.CONTATO.telefone, '(31) 99186-7625');
  assert.match(store.CONTATO.whatsapp, /wa\.me\/5531991867625/);
  assert.equal(store.CONTATO.endereco, '');
  assert.equal(store.CONTATO.horario, 'Todos os dias · 18h às 21h');
});

test('photoFor é determinística e mapeia por palavra-chave', () => {
  assert.equal(store.photoFor('Pizza Margherita', 'Tradicionais'), 'images/pizza-margherita.jpg');
  assert.equal(store.photoFor('Calabresa Especial', ''), 'images/pizza-calabresa.jpg');
  assert.equal(store.photoFor('Frango com Catupiry', ''), 'images/pizza-frango.jpg');
  // fallback estável: mesma entrada -> mesma foto
  const a = store.photoFor('Pizza Exótica XYZ', 'Nova');
  const b = store.photoFor('Pizza Exótica XYZ', 'Nova');
  assert.equal(a, b);
  assert.ok(store.FOTOS.galeria.includes(a));
});

test('FOTOS aponta para arquivos dentro de images/', () => {
  assert.ok(store.FOTOS.hero.startsWith('images/'));
  assert.equal(store.FOTOS.galeria.length, 6);
});

test('saveItem armazena e recupera foto customizada do produto', () => {
  const customFoto = 'data:image/jpeg;base64,test_custom_photo_data';
  const item = store.saveItem({
    nome: 'Pizza Trufada Especial',
    categoria: 'Especiais',
    preco: 79.90,
    descricao: 'Trufas negras com queijo brie',
    estoque: 20,
    foto: customFoto,
    destaque: true,
    ativo: true,
  });

  assert.ok(item.id);
  assert.equal(item.foto, customFoto);
  assert.equal(item.destaque, true);

  const found = store.getItems().find(i => i.id === item.id);
  assert.ok(found);
  assert.equal(found.foto, customFoto);
  assert.equal(found.destaque, true);
  assert.equal(store.photoFor(found.nome, found.categoria, found.foto), customFoto);
});

test('getDestaques e toggleDestaque gerenciam anúncios da Home corretamente', () => {
  localStorage.clear();
  const itensIniciais = store.getDestaques();
  assert.ok(itensIniciais.length > 0, 'Deve retornar ao menos 1 item em destaque');

  const primeiro = store.getItems()[0];
  const estadoAntes = Boolean(primeiro.destaque);
  store.toggleDestaque(primeiro.id);
  
  const atualizado = store.getItem(primeiro.id);
  assert.equal(atualizado.destaque, !estadoAntes, 'toggleDestaque deve inverter o status de destaque');

  store.toggleDestaque(primeiro.id);
  const revertido = store.getItem(primeiro.id);
  assert.equal(revertido.destaque, estadoAntes, 'toggleDestaque deve reverter ao estado original');
});

test('formatarTelefone formata números brasileiros de 10, 11, 12 e 13 dígitos', () => {
  assert.equal(store.formatarTelefone('31996678280'), '(31) 99667-8280');
  assert.equal(store.formatarTelefone('5531996678280'), '(31) 99667-8280');
  assert.equal(store.formatarTelefone('3132221234'), '(31) 3222-1234');
  assert.equal(store.formatarTelefone('553132221234'), '(31) 3222-1234');
  assert.equal(store.formatarTelefone('9991867625'), '(99) 9186-7625');
  assert.equal(store.formatarTelefone('559991867625'), '(99) 9186-7625');
  assert.equal(store.formatarTelefone(''), '');
  assert.equal(store.formatarTelefone(null), '');
});

test('updateContatoTelefone atualiza dinamicamente store.CONTATO', () => {
  const c1 = store.updateContatoTelefone('5531996678280');
  assert.equal(c1.telefone, '(31) 99667-8280');
  assert.equal(c1.telefoneDigits, '5531996678280');
  assert.equal(c1.whatsapp, 'https://wa.me/5531996678280');
  assert.match(c1.whatsappMsg, /wa\.me\/5531996678280/);

  const c2 = store.updateContatoTelefone('11987654321');
  assert.equal(c2.telefone, '(11) 98765-4321');
  assert.equal(c2.telefoneDigits, '5511987654321');
  assert.equal(c2.whatsapp, 'https://wa.me/5511987654321');
});



