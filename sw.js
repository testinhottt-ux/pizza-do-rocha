// sw.js — Service Worker da Pizzaria do Rocha (Network-First com Limpeza Automática de Cache)
const CACHE_NAME = 'pizzaria-rocha-v2.8.5';

self.addEventListener('install', (event) => {
  // Ativação imediata sem esperar o fechamento de abas
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Deleta TODOS os caches antigos (inclusive 'pizzaria-rocha-v1' que travava os navegadores)
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NUNCA usar cache para API, painel admin ou requisições não-GET
  if (url.pathname.startsWith('/api/') || url.pathname === '/ad' || event.request.method !== 'GET') {
    return;
  }

  // 2. ESTRATÉGIA NETWORK-FIRST PARA TODAS AS PÁGINAS E ARQUIVOS:
  // Sempre busca a versão mais recente do servidor na rede.
  // Somente usa o cache como fallback se o usuário estiver sem internet (offline).
  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback offline caso o dispositivo perca a conexão
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
