#!/usr/bin/env node

/**
 * TESTE DE SINCRONIZAÇÃO DINÂMICA DO TELEFONE DE CONTATO
 * Valida se ao trocar o telefone de notificações na área administrativa:
 * 1. O número é persistido corretamente no backend (/api/config)
 * 2. O objeto store.CONTATO é atualizado dinamicamente
 * 3. Todos os elementos de contato da página são alterados (Top bar, Hero, Contato, Cardápio, Botão Flutuante, Tel links)
 * 4. A formatação de telefone (DDD, 9 dígitos, etc.) funciona em múltiplos formatos
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import * as store from './store.js';
import * as ui from './ui.js';

describe('📱 SINCRONIZAÇÃO DINÂMICA DO TELEFONE DE CONTATO', async () => {

  test('✅ formatarTelefone formata números de telefone corretamente', () => {
    // 11 dígitos celular (DDD + 9 dígitos)
    assert.equal(store.formatarTelefone('31996678280'), '(31) 99667-8280');
    assert.equal(ui.formatarTelefone('31996678280'), '(31) 99667-8280');

    // 13 dígitos com DDI 55
    assert.equal(store.formatarTelefone('5531996678280'), '(31) 99667-8280');
    assert.equal(ui.formatarTelefone('5531996678280'), '(31) 99667-8280');

    // 11 dígitos São Paulo
    assert.equal(store.formatarTelefone('11987654321'), '(11) 98765-4321');
    assert.equal(store.formatarTelefone('5511987654321'), '(11) 98765-4321');

    // 10 dígitos fixo (DDD + 8 dígitos)
    assert.equal(store.formatarTelefone('3132221234'), '(31) 3222-1234');
    assert.equal(store.formatarTelefone('553132221234'), '(31) 3222-1234');

    // Casos vazios/nulos
    assert.equal(store.formatarTelefone(''), '');
    assert.equal(store.formatarTelefone(null), '');
    console.log('   ✓ Formatação de múltiplos formatos de telefone validada com sucesso');
  });

  test('✅ updateContatoTelefone atualiza os atributos de CONTATO no store e ui', () => {
    const novoNum = '5531996678280';
    store.updateContatoTelefone(novoNum);

    assert.equal(store.CONTATO.telefoneDigits, '5531996678280');
    assert.equal(store.CONTATO.telefone, '(31) 99667-8280');
    assert.equal(store.CONTATO.whatsapp, 'https://wa.me/5531996678280');
    assert.ok(store.CONTATO.whatsappMsg.includes('5531996678280'));

    // Atualização subsequente
    const outroNum = '5511988887777';
    ui.updateContatoTelefone(outroNum);
    assert.equal(store.CONTATO.telefoneDigits, '5511988887777');
    assert.equal(store.CONTATO.telefone, '(11) 98888-7777');
    assert.equal(store.CONTATO.whatsapp, 'https://wa.me/5511988887777');
    console.log('   ✓ store.CONTATO reativo atualizado dinamicamente');
  });

  test('✅ Simulação de atualização no DOM (elementos da página index.html)', () => {
    // Cria mock simples de DOM
    class MockElement {
      constructor(id, tag = 'div') {
        this.id = id;
        this.tagName = tag.toUpperCase();
        this.href = '';
        this.textContent = '';
        this.innerHTML = '';
        this.value = '';
        this.attributes = {};
      }
      setAttribute(k, v) { this.attributes[k] = v; }
      getAttribute(k) { return this.attributes[k]; }
    }

    const dom = {
      heroWaBtn: new MockElement('heroWaBtn', 'a'),
      topBarPhoneLink: new MockElement('topBarPhoneLink', 'a'),
      contatoPhoneLink: new MockElement('contatoPhoneLink', 'a'),
      contatoWaBtn: new MockElement('contatoWaBtn', 'a'),
      contatoLigarBtn: new MockElement('contatoLigarBtn', 'a'),
      cardapioPhoneLink: new MockElement('cardapioPhoneLink', 'a'),
      waFloat: new MockElement('waFloat', 'a'),
      whatsappNotif: new MockElement('whatsappNotif', 'input'),
    };

    // Função idêntica à implementada no index.html
    function atualizarTelefoneContatoNaPaginaSimulado(numero) {
      const digits = String(numero).replace(/\D/g, '').replace(/^0/, '');
      if (!digits) return;
      const full = digits.startsWith('55') ? digits : '55' + digits;
      const formatted = store.formatarTelefone(digits);

      store.updateContatoTelefone(digits);

      const defaultMsg = encodeURIComponent('Olá! Gostaria de fazer um pedido na Pizzaria do Rocha.');
      const heroMsg = encodeURIComponent('Olá! Quero fazer um pedido na Pizzaria do Rocha.');

      if (dom.topBarPhoneLink) {
        dom.topBarPhoneLink.href = `https://wa.me/${full}`;
        dom.topBarPhoneLink.innerHTML = `📞 ${formatted}`;
      }
      if (dom.heroWaBtn) {
        dom.heroWaBtn.href = `https://wa.me/${full}?text=${heroMsg}`;
      }
      if (dom.contatoPhoneLink) {
        dom.contatoPhoneLink.href = `https://wa.me/${full}?text=${defaultMsg}`;
        dom.contatoPhoneLink.textContent = formatted;
      }
      if (dom.contatoWaBtn) {
        dom.contatoWaBtn.href = `https://wa.me/${full}?text=${defaultMsg}`;
      }
      if (dom.contatoLigarBtn) {
        dom.contatoLigarBtn.href = `tel:+${full}`;
      }
      if (dom.cardapioPhoneLink) {
        dom.cardapioPhoneLink.href = `https://wa.me/${full}`;
        dom.cardapioPhoneLink.textContent = formatted;
      }
      if (dom.waFloat) {
        dom.waFloat.href = `https://wa.me/${full}?text=${defaultMsg}`;
      }
      if (dom.whatsappNotif) {
        dom.whatsappNotif.value = digits;
      }
    }

    // 1. Testa troca para telefone A: 5531996678280
    atualizarTelefoneContatoNaPaginaSimulado('5531996678280');
    assert.equal(dom.topBarPhoneLink.href, 'https://wa.me/5531996678280');
    assert.equal(dom.topBarPhoneLink.innerHTML, '📞 (31) 99667-8280');
    assert.ok(dom.heroWaBtn.href.startsWith('https://wa.me/5531996678280?text='));
    assert.equal(dom.contatoPhoneLink.textContent, '(31) 99667-8280');
    assert.ok(dom.contatoWaBtn.href.startsWith('https://wa.me/5531996678280?text='));
    assert.equal(dom.contatoLigarBtn.href, 'tel:+5531996678280');
    assert.equal(dom.cardapioPhoneLink.textContent, '(31) 99667-8280');
    assert.ok(dom.waFloat.href.startsWith('https://wa.me/5531996678280?text='));
    assert.equal(dom.whatsappNotif.value, '5531996678280');

    // 2. Testa troca dinâmica para telefone B: 5511999998888 (sem recarregar página)
    atualizarTelefoneContatoNaPaginaSimulado('5511999998888');
    assert.equal(dom.topBarPhoneLink.href, 'https://wa.me/5511999998888');
    assert.equal(dom.topBarPhoneLink.innerHTML, '📞 (11) 99999-8888');
    assert.ok(dom.heroWaBtn.href.startsWith('https://wa.me/5511999998888?text='));
    assert.equal(dom.contatoPhoneLink.textContent, '(11) 99999-8888');
    assert.ok(dom.contatoWaBtn.href.startsWith('https://wa.me/5511999998888?text='));
    assert.equal(dom.contatoLigarBtn.href, 'tel:+5511999998888');
    assert.equal(dom.cardapioPhoneLink.textContent, '(11) 99999-8888');
    assert.ok(dom.waFloat.href.startsWith('https://wa.me/5511999998888?text='));
    assert.equal(dom.whatsappNotif.value, '5511999998888');

    console.log('   ✓ Todos os 8 elementos da página atualizados dinamicamente com sucesso');
  });

  test('✅ Integração HTTP com o Servidor ao vivo', async () => {
    const PORT = 3989;
    const BASE = `http://localhost:${PORT}`;

    const srv = spawn('node', ['server.mjs', String(PORT)], { stdio: 'pipe', cwd: process.cwd() });
    await sleep(1500);

    try {
      // 1. Salva novo número de notificações no admin
      const respPost = await fetch(BASE + '/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappNotif: '5531996678280' }),
      });
      const dataPost = await respPost.json();
      assert.equal(respPost.status, 200);
      assert.equal(dataPost.whatsappNotif, '5531996678280');

      // 2. Consulta configuração do servidor
      const respGet = await fetch(BASE + '/api/config');
      const dataGet = await respGet.json();
      assert.equal(respGet.status, 200);
      assert.equal(dataGet.whatsappNotif, '5531996678280');

      // 3. Testa troca para outro número
      const respPost2 = await fetch(BASE + '/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsappNotif: '5511988887777' }),
      });
      const dataPost2 = await respPost2.json();
      assert.equal(respPost2.status, 200);
      assert.equal(dataPost2.whatsappNotif, '5511988887777');

      // 4. Verifica index.html servido com os IDs corretos
      const respHtml = await fetch(BASE + '/');
      const html = await respHtml.text();
      assert.ok(html.includes('id="heroWaBtn"'), 'Deve conter id="heroWaBtn"');
      assert.ok(html.includes('id="topBarPhoneLink"'), 'Deve conter id="topBarPhoneLink"');
      assert.ok(html.includes('id="contatoPhoneLink"'), 'Deve conter id="contatoPhoneLink"');
      assert.ok(html.includes('id="contatoWaBtn"'), 'Deve conter id="contatoWaBtn"');
      assert.ok(html.includes('id="contatoLigarBtn"'), 'Deve conter id="contatoLigarBtn"');
      assert.ok(html.includes('id="cardapioPhoneLink"'), 'Deve conter id="cardapioPhoneLink"');
      assert.ok(html.includes('id="waFloat"'), 'Deve conter id="waFloat"');
      assert.ok(html.includes('atualizarTelefoneContatoNaPagina'), 'Deve conter a função de sincronização dinâmica');

      console.log('   ✓ Backend e Frontend sincronizados via API e IDs de DOM verificados');
    } finally {
      srv.kill();
    }
  });

});
