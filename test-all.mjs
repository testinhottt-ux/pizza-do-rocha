#!/usr/bin/env node

/**
 * TESTE E2E COMPLETO — Pizzaria do Rocha
 * Valida: Home → Cardápio → Carrinho → Checkout → Admin
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage
class LocalStorageMock {
  constructor() { this.store = new Map(); }
  getItem(k) { return this.store.has(k) ? this.store.get(k) : null; }
  setItem(k, v) { this.store.set(k, String(v)); }
  removeItem(k) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

globalThis.localStorage = new LocalStorageMock();

// Importar store
const store = await import('./store.js');

describe('🍕 PIZZARIA DO ROCHA — SUITE COMPLETA', async () => {
  test('✅ Carregamento inicial com seed', () => {
    const items = store.getItems();
    assert.ok(items.length > 0, 'Deve ter itens seedados');
    assert.equal(items.length, 12, 'Deve ter 12 opções (8 pizzas + 4 bebidas)');
    assert.ok(items.filter(i => i.categoria === 'Bebidas').length >= 4, 'Seed inclui bebidas');
    console.log(`   ✓ ${items.length} produtos: ${items.filter(i => i.categoria === 'Bebidas').length} bebidas + ${items.length - items.filter(i => i.categoria === 'Bebidas').length} pizzas`);
  });

  test('✅ Fotos de bebidas (ilustrativas) são resolvidas', () => {
    const cocas = store.getItems().find(i => i.nome.includes('Coca'));
    const foto = store.photoFor(cocas.nome, cocas.categoria);
    assert.ok(foto.includes('bebida-cola.svg'), 'Coca deve mapear para bebida-cola.svg, veio: ' + foto);
    const suco = store.getItems().find(i => i.nome.includes('Suco'));
    assert.ok(store.photoFor(suco.nome, suco.categoria).includes('bebida-suco.svg'), 'Suco → bebida-suco.svg');
    console.log(`   ✓ Coca → ${foto}`);
  });

  test('✅ Contato e informações', () => {
    assert.ok(store.CONTATO.telefone, 'Deve ter telefone');
    assert.ok(store.CONTATO.whatsappMsg, 'Deve ter WhatsApp');
    assert.equal(store.CONTATO.horario, 'Todos os dias · 18h às 21h');
    console.log(`   ✓ Telefone: ${store.CONTATO.telefone}`);
    console.log(`   ✓ Horário: ${store.CONTATO.horario}`);
  });

  test('✅ Fotos carregam corretamente', () => {
    const margherita = store.getItems().find(i => i.nome.startsWith('Marguerita'));
    const foto = store.photoFor(margherita.nome, margherita.categoria);
    assert.ok(foto.includes('images/'), 'Foto deve estar em /images/');
    console.log(`   ✓ Margherita → ${foto}`);
  });

  test('✅ Fluxo de compra: Add → Carrinho → Checkout', () => {
    localStorage.clear();
    
    // 1. Add item
    const item = store.saveItem({
      nome: 'Pepperoni Test', categoria: 'Testes', preco: 50,
      descricao: 'Para teste E2E', estoque: 5, ativo: true
    });
    assert.ok(item.id, 'Item deve ter ID');
    console.log(`   ✓ Pizza criada: ${item.nome} (ID: ${item.id})`);

    // 2. Add to cart
    store.addToCart(item.id, 2);
    assert.equal(store.cartCount(), 2, 'Carrinho deve ter 2 unidades');
    console.log(`   ✓ 2× Pepperoni added ao carrinho`);

    // 3. Aumentar qtd
    store.addToCart(item.id, 1);
    assert.equal(store.cartCount(), 3, 'Carrinho deve ter 3 unidades');
    console.log(`   ✓ Quantidade atualizada para 3`);

    // 4. Total
    const total = store.cartTotal();
    assert.equal(total, 150, 'Total deve ser 50 × 3 = 150');
    console.log(`   ✓ Total: R$ ${total.toFixed(2)}`);

    // 5. Checkout
    const order = store.createOrder({
      cliente: { nome: 'João Silva', telefone: '+55 31 9999-9999', endereco: 'Rua Teste, 123' },
      pagamento: { metodo: 'pix', status: 'aprovado' }
    });
    assert.ok(order.id, 'Pedido deve ter ID');
    assert.equal(order.total, 150, 'Pedido deve ter total = 150');
    assert.equal(order.status, 'recebido', 'Status inicial deve ser "recebido"');
    console.log(`   ✓ Pedido #${order.numero} criado (R$ ${order.total})`);

    // 6. Carrinho limpo
    assert.equal(store.cartCount(), 0, 'Carrinho deve estar vazio após checkout');
    console.log(`   ✓ Carrinho limpo automaticamente`);

    // 7. Estoque reduzido
    const itemAtualizado = store.getItems().find(i => i.id === item.id);
    assert.equal(itemAtualizado.estoque, 2, 'Estoque deve ter reduzido de 5 para 2');
    console.log(`   ✓ Estoque reduzido: 5 → ${itemAtualizado.estoque}`);
  });

  test('✅ Fluxo Admin: CRUD + Estoque + Status', () => {
    localStorage.clear();

    // 1. Criar pizza
    const pizza = store.saveItem({
      nome: 'Calabresa Admin', categoria: 'Tradicionais', preco: 45,
      descricao: 'Calabresa com cebola', estoque: 10, ativo: true
    });
    assert.ok(pizza.id, 'Pizza criada');
    console.log(`   ✓ Pizza criada: ${pizza.nome}`);

    // 2. Editar
    pizza.preco = 48;
    store.saveItem(pizza);
    const updated = store.getItems().find(i => i.id === pizza.id);
    assert.equal(updated.preco, 48, 'Preço deve ser 48');
    console.log(`   ✓ Preço atualizado: 45 → 48`);

    // 3. Ajustar estoque
    store.adjustStock(pizza.id, -3);
    const adjusted = store.getItems().find(i => i.id === pizza.id);
    assert.equal(adjusted.estoque, 7, 'Estoque deve ser 7');
    console.log(`   ✓ Estoque ajustado: 10 → 7`);

    // 4. Pedido e avançar status
    store.addToCart(pizza.id, 1);
    const order = store.createOrder({
      cliente: { nome: 'Maria', telefone: '+55 31 9888-8888', endereco: 'Rua Admin' },
      pagamento: { metodo: 'cartao', status: 'aprovado' }
    });
    assert.equal(order.status, 'recebido');
    console.log(`   ✓ Pedido criado com status: ${store.statusLabel(order.status)}`);

    // 5. Avançar status
    store.updateOrderStatus(order.id, 'preparando');
    const updatedOrder = store.getOrder(order.id);
    assert.equal(updatedOrder.status, 'preparando');
    console.log(`   ✓ Status avançado: recebido → preparando`);

    // 6. Desativar
    store.saveItem({ ...pizza, ativo: false });
    const inactive = store.getItems().find(i => i.id === pizza.id);
    assert.equal(inactive.ativo, false);
    console.log(`   ✓ Pizza desativada`);

    // 7. Deletar
    const countBefore = store.getItems().length;
    store.deleteItem(pizza.id);
    const countAfter = store.getItems().length;
    assert.equal(countAfter, countBefore - 1, 'Deve ter deletado');
    console.log(`   ✓ Pizza deletada`);
  });

  test('✅ Senha Admin', () => {
    assert.ok(store.checkAdminPass('pizzadorochaboademais'), 'Senha correta');
    assert.equal(store.checkAdminPass('wrongpass'), false, 'Senha errada');
    console.log(`   ✓ Autenticação admin funcionando`);
  });

  test('✅ Pedidos e ordenação', () => {
    localStorage.clear();
    const item = store.saveItem({ nome: 'Test', categoria: 'Test', preco: 25, estoque: 100, ativo: true });

    // Criar 3 pedidos
    for (let i = 0; i < 3; i++) {
      store.addToCart(item.id, 1);
      const order = store.createOrder({
        cliente: { nome: `Cliente ${i}`, telefone: '111', endereco: 'Teste' },
        pagamento: { metodo: 'pix', status: 'aprovado' }
      });
    }

    const orders = store.getOrders();
    assert.equal(orders.length, 3, '3 pedidos');
    // Verificar que estão em ordem decrescente (mais recente primeiro)
    for (let i = 1; i < orders.length; i++) {
      assert.ok(orders[i - 1].criadoEm >= orders[i].criadoEm, 'Deve estar ordenado');
    }
    console.log(`   ✓ ${orders.length} pedidos, ordenados corretamente`);
  });

  test('✅ Personalização: Pizza Meio a Meio e Borda Recheada', () => {
    localStorage.clear();
    const pizza1 = store.saveItem({ nome: 'Portuguesa Gigante', categoria: 'Pizzas', preco: 59.99, estoque: 10, ativo: true });
    const pizza2 = store.saveItem({ nome: 'Calabresa Gigante', categoria: 'Pizzas', preco: 54.99, estoque: 10, ativo: true });
    
    // Meio a meio cobra pelo maior valor (59.99) + Borda Catupiry (8.00) = 67.99
    const precoFinal = Math.max(pizza1.preco, pizza2.preco) + 8.00;
    const customPizza = store.saveItem({
      nome: `½ ${pizza1.nome} + ½ ${pizza2.nome} · Borda Catupiry Original`,
      categoria: 'Pizzas',
      preco: precoFinal,
      estoque: 999,
      ativo: true
    });

    store.addToCart(customPizza.id, 1);
    assert.equal(store.cartCount(), 1);
    assert.equal(store.cartTotal(), 67.99);

    const order = store.createOrder({
      cliente: { nome: 'Cliente Meio a Meio', telefone: '99999999', endereco: 'Rua das Pizzas, 100' },
      pagamento: { metodo: 'pix', status: 'pendente' }
    });

    assert.equal(order.total, 67.99);
    assert.ok(order.itens[0].nome.includes('½ Portuguesa'));
    console.log(`   ✓ Pizza Meio a Meio com Borda: R$ ${order.total.toFixed(2)}`);
  });
});

console.log('\n✅ SUITE COMPLETA FINALIZADA\n');
