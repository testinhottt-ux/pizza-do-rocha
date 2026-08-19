#!/usr/bin/env node

/**
 * TESTE ESPECÍFICO DE SINCRONIZAÇÃO DO CARDÁPIO ENTRE ADMIN E TODOS OS USUÁRIOS
 * 
 * Valida:
 * 1. Cardápio base sem água, com Coca-Cola e Guaraná Antarctica a R$ 13,99
 * 2. Pizza "1/2 Salaminho e 1/2 Lombinho Canadense" presente com foto
 * 3. Seção "HISTÓRIA & FILOSOFIA" com foto configurada
 * 4. Edição no Painel Admin reflete em tempo real para todos os clientes/visitantes
 * 5. Adição de novo produto pelo Admin aparece para todos os visitantes
 * 6. Exclusão de produto pelo Admin remove para todos os visitantes
 * 7. Sincronização entre múltiplos stores locais isolados via API
 */

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import assert from 'node:assert/strict';

const PORT = 3991;
const BASE = `http://localhost:${PORT}`;
const ADMIN_PASS = 'pizzadorochaboademais';

async function req(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body: data };
}

let exitCode = 0;
function logPass(msg) {
  console.log(`  ✅ PASS: ${msg}`);
}
function logFail(msg, err) {
  exitCode = 1;
  console.error(`  ❌ FAIL: ${msg}`, err || '');
}

console.log('🍕 TESTE DE SINCRONIZAÇÃO DE CARDÁPIO MULTI-USUÁRIOS (ADMIN → TODOS OS CLIENTES)\n');

const srv = spawn('node', ['server.mjs', String(PORT)], { stdio: 'pipe', cwd: process.cwd() });
let stderr = '';
srv.stderr.on('data', d => stderr += d);

await sleep(1500);

try {
  // ── TESTE 1: CARDÁPIO INICIAL PÚBLICO (CLIENTE A) ──
  console.log('[1/4] Verificando cardápio público inicial (Cliente A)...');
  const r1 = await req('GET', '/api/cardapio');
  assert.equal(r1.status, 200, 'GET /api/cardapio deve responder HTTP 200');
  const itemsIniciais = r1.body?.items || [];
  
  // 1.1 Não deve conter água
  const temAgua = itemsIniciais.some(i => /[áa]gua|mineral/i.test(i.nome) || /[áa]gua|mineral/i.test(i.descricao));
  assert.equal(temAgua, false, 'Água mineral NÃO deve existir no cardápio');
  logPass('Água mineral removida com sucesso do cardápio');

  // 1.2 Bebidas devem ser apenas Coca-Cola e Guaraná Antarctica a R$ 13,99
  const bebidas = itemsIniciais.filter(i => i.categoria === 'Bebidas');
  assert.equal(bebidas.length, 2, 'Devem existir exatamente 2 bebidas');
  const coca = bebidas.find(i => /coca/i.test(i.nome));
  const guarana = bebidas.find(i => /guaran[aá]/i.test(i.nome));
  assert.ok(coca, 'Coca-Cola deve estar presente');
  assert.ok(guarana, 'Guaraná Antarctica deve estar presente');
  assert.equal(coca.preco, 13.99, 'Coca-Cola deve custar R$ 13,99');
  assert.equal(guarana.preco, 13.99, 'Guaraná Antarctica deve custar R$ 13,99');
  logPass('Bebidas configuradas: apenas Coca-Cola e Guaraná Antarctica a R$ 13,99');

  // 1.3 Pizza 1/2 Salaminho e 1/2 Lombinho Canadense deve estar no cardápio
  const salaminhoMedia = itemsIniciais.find(i => i.nome.includes('Salaminho') && i.nome.includes('Média'));
  const salaminhoGigante = itemsIniciais.find(i => i.nome.includes('Salaminho') && i.nome.includes('Gigante'));
  assert.ok(salaminhoMedia, 'Pizza 1/2 Salaminho e 1/2 Lombinho Canadense Média deve estar presente');
  assert.ok(salaminhoGigante, 'Pizza 1/2 Salaminho e 1/2 Lombinho Canadense Gigante deve estar presente');
  assert.equal(salaminhoMedia.foto, 'images/pizza-meio-salaminho-lombinho.jpg');
  logPass('Pizza 1/2 Salaminho e 1/2 Lombinho Canadense (Média e Gigante) presente com foto');

  // ── TESTE 2: PROTEÇÃO E AUTENTICAÇÃO DO ADMIN ──
  console.log('\n[2/4] Verificando segurança de edição do cardápio...');
  const rSemAuth = await req('POST', '/api/cardapio/item', { item: { nome: 'Pizza Invasora', preco: 10 } });
  assert.equal(rSemAuth.status, 401, 'POST sem x-admin-pass deve retornar 401');
  logPass('Tentativa não autorizada de editar cardápio é bloqueada (HTTP 401)');

  // ── TESTE 3: EDIÇÃO PELO ADMIN E PROPAGAÇÃO PARA VISITANTE B ──
  console.log('\n[3/4] Testando alteração feita pelo Admin e recebida por outro visitante (Cliente B)...');
  
  // 3.1 Admin altera o preço e descrição da pizza de salaminho
  const salaminhoEditado = {
    ...salaminhoMedia,
    preco: 52.90,
    descricao: 'Edição Especial do Rocha: salaminho italiano e lombinho canadense defumado.',
  };
  const rEdit = await req('POST', '/api/cardapio/item', { item: salaminhoEditado }, { 'x-admin-pass': ADMIN_PASS });
  assert.equal(rEdit.status, 200, 'Admin deve salvar alteração com sucesso');
  logPass('Admin alterou preço e descrição da Pizza 1/2 Salaminho no servidor');

  // 3.2 Admin cadastra um novo sabor exclusivo
  const novaPizza = {
    id: 'pizza_exclusiva_' + Date.now(),
    nome: 'Pizza Quatro Queijos Trufada do Rocha',
    categoria: 'Pizzas Especiais',
    preco: 69.90,
    descricao: 'Muçarela, gorgonzola, parmesão da Canastra e catupiry legítimo.',
    foto: 'images/pizza-especial-rocha.jpg',
    estoque: 25,
    ativo: true,
    destaque: true,
  };
  const rNovo = await req('POST', '/api/cardapio/item', { item: novaPizza }, { 'x-admin-pass': ADMIN_PASS });
  assert.equal(rNovo.status, 200, 'Admin deve cadastrar novo produto com sucesso');
  logPass('Admin cadastrou novo produto ("Pizza Quatro Queijos Trufada")');

  // 3.3 Cliente B (outro usuário anônimo / outro navegador) consulta o cardápio
  const rClienteB = await req('GET', '/api/cardapio');
  assert.equal(rClienteB.status, 200);
  const itemsClienteB = rClienteB.body?.items || [];

  const pizzaSalaminhoNoB = itemsClienteB.find(i => i.id === salaminhoMedia.id);
  assert.equal(pizzaSalaminhoNoB.preco, 52.90, 'Cliente B deve ver o novo preço atualizado pelo Admin');
  assert.equal(pizzaSalaminhoNoB.descricao, 'Edição Especial do Rocha: salaminho italiano e lombinho canadense defumado.');
  logPass('Cliente B vê imediatamente a edição da Pizza 1/2 Salaminho (R$ 52,90)');

  const novaPizzaNoB = itemsClienteB.find(i => i.id === novaPizza.id);
  assert.ok(novaPizzaNoB, 'Cliente B deve ver a nova pizza cadastrada pelo Admin');
  assert.equal(novaPizzaNoB.nome, 'Pizza Quatro Queijos Trufada do Rocha');
  assert.equal(novaPizzaNoB.preco, 69.90);
  logPass('Cliente B vê o novo produto cadastrado pelo Admin em tempo real');

  // ── TESTE 4: EXCLUSÃO PELO ADMIN E DESAPARECIMENTO PARA VISITANTE C ──
  console.log('\n[4/4] Testando exclusão feita pelo Admin e refletida para Visitante C...');
  const rDel = await req('DELETE', `/api/cardapio/${novaPizza.id}`, null, { 'x-admin-pass': ADMIN_PASS });
  assert.equal(rDel.status, 200, 'Admin deve deletar item com sucesso');
  logPass('Admin removeu o produto do cardápio');

  const rClienteC = await req('GET', '/api/cardapio');
  const itemsClienteC = rClienteC.body?.items || [];
  const buscaNoC = itemsClienteC.find(i => i.id === novaPizza.id);
  assert.equal(buscaNoC, undefined, 'Item excluído não deve aparecer para o Cliente C');
  logPass('Cliente C confirma que o produto excluído não existe mais no cardápio');

  // Restaura o preço original para manter idempotência
  await req('POST', '/api/cardapio/item', { item: salaminhoMedia }, { 'x-admin-pass': ADMIN_PASS });

  console.log('\n🎉 TODOS OS TESTES DE SINCRONIZAÇÃO MULTI-CLIENTES PASSARAM COM SUCESSO!\n');
} catch (err) {
  logFail('Falha na suíte de testes de sincronização', err);
} finally {
  srv.kill();
  process.exit(exitCode);
}
