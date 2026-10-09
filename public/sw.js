/*
 * Service Worker — "O Projeto Principal" (offline-first, Fase 5).
 *
 * Estratégias:
 *  - navegação (a shell do app): stale-while-revalidate — offline funciona,
 *    online atualiza o cache em background;
 *  - /pdfs/ e /data/ (o acervo): cache-first — depois do primeiro download,
 *    o material abre sem rede (pedidos com Range passam direto para a rede);
 *  - /_next/static e ícones: cache-first (imutáveis por hash);
 *  - /api/*: SEMPRE rede (o tutor é vivo) — sem fallback enganoso;
 *  - resto GET: network-first com cache como fallback honesto.
 */
const CACHE = 'hub-projeto-principal-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Range (streaming de PDF) → rede direta; cache só guardaria a fatia errada
  if (req.headers.has('range')) return;

  // API viva (tutor SSE etc.) → rede sempre
  if (url.pathname.startsWith('/api/')) return;

  // acervo: cache-first (o material uma vez baixado abre offline para sempre)
  if (url.pathname.startsWith('/pdfs/') || url.pathname.startsWith('/data/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          }),
      )
    );
    return;
  }

  // estáticos imutáveis
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          }),
      )
    );
    return;
  }

  // navegação: stale-while-revalidate (offline abre a shell; online renova)
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then((hit) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put('/', copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    );
    return;
  }

  // resto: network-first com fallback de cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
