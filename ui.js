// ui.js — componentes compartilhados (nav, footer, whatsapp) em vanilla JS.
import { CONTATO, cartCount } from './store.js';

const WA_SVG = '<svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.4.7 4.6 1.9 6.5L4 29l7-1.8c1.8 1 3.8 1.5 5.9 1.5 6.6 0 12-5.3 12-11.9C28.9 8.3 22.6 3 16 3zm0 21.6c-1.9 0-3.7-.5-5.3-1.5l-.4-.2-4.1 1.1 1.1-4-.3-.4a9.6 9.6 0 01-1.5-5.2C5.6 9.6 10.3 5 16 5s10.4 4.6 10.4 9.9-4.7 9.7-10.4 9.7zm5.7-7.3c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.3 8.3 0 01-2.5-1.5 9 9 0 01-1.7-2.1c-.2-.3 0-.5.1-.7l.5-.6.3-.5c.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.4 5.3 4.7l1.8.6c.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4z"/></svg>';

// Escapa HTML para evitar injeção ao renderizar dados do usuário.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function renderNav(active) {
  const link = (href, label, key) =>
    `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`;
  return `
  <nav class="nav">
    <a href="Home.dc.html" class="brand">PIZZARIA <span>DO ROCHA</span></a>
    <div class="nav-links">
      ${link('Cardapio.dc.html', 'CARDÁPIO', 'cardapio')}
      ${link('Pedido.dc.html', 'MEU PEDIDO', 'pedido')}
      ${link('Home.dc.html#contato', 'CONTATO', 'contato')}
      <a href="Carrinho.dc.html" class="cart-pill ${active === 'carrinho' ? 'active' : ''}">
        CARRINHO <span class="badge" data-cart-badge>${cartCount()}</span>
      </a>
    </div>
  </nav>`;
}

export function renderFooter() {
  return `
  <footer class="footer">
    <div class="row">
      <div style="max-width: 320px;">
        <span class="brand" style="font-size:24px;">PIZZARIA <span>DO ROCHA</span></span>
        <p style="font-size:14px;color:var(--musgo);line-height:1.6;margin:12px 0 0;">
           ${CONTATO.endereco ? `${esc(CONTATO.endereco)}<br>` : ''}${esc(CONTATO.telefone)}
        </p>
      </div>
      <div style="display:flex;gap:32px;font-size:14px;flex-wrap:wrap;">
        <a href="Cardapio.dc.html">Cardápio</a>
        <a href="Carrinho.dc.html">Carrinho</a>
        <a href="Pedido.dc.html">Meu pedido</a>
        <a href="Home.dc.html#contato">Contato</a>
      </div>
    </div>
    <p class="note">Atendimento: ${esc(CONTATO.horario)} · Entrega rápida · WhatsApp e iFood.</p>
  </footer>`;
}

export function renderWhatsApp() {
  const numero = (typeof window !== 'undefined' && window.APP_WHATSAPP) || '559991867625';
  const href = `https://wa.me/${numero}?text=${encodeURIComponent('Olá! Gostaria de fazer um pedido na Pizzaria do Rocha.')}`;
  return `<a class="wa-float" href="${href}" target="_blank" rel="noopener" aria-label="WhatsApp">${WA_SVG} WhatsApp</a>`;
}

// Carrega o número oficial do servidor (config admin) e atualiza os links wa.me da página.
export async function syncWhatsAppFromServer() {
  try {
    const r = await fetch('/api/config');
    const cfg = await r.json();
    if (cfg.whatsappNotif) {
      const num = String(cfg.whatsappNotif).replace(/\D/g, '').replace(/^0/, '');
      const full = num.startsWith('55') ? num : '55' + num;
      window.APP_WHATSAPP = full;
      document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a => {
        const msg = a.href.includes('?text=') ? a.href.split('?text=')[1] : encodeURIComponent('Olá! Gostaria de fazer um pedido na Pizzaria do Rocha.');
        a.href = `https://wa.me/${full}?text=${msg}`;
      });
      // botão flutuante index.html (fora do DOM compartilhado)
      const float = document.getElementById('waFloat');
      if (float) float.href = `https://wa.me/${full}?text=${encodeURIComponent('Olá! Gostaria de fazer um pedido na Pizzaria do Rocha.')}`;
    }
  } catch (e) { /* offline: mantém número padrão */ }
}

// Atualiza o badge do carrinho em qualquer página.
export function refreshCartBadge() {
  document.querySelectorAll('[data-cart-badge]').forEach((el) => { el.textContent = cartCount(); });
}

// Toast simples reutilizável.
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}
