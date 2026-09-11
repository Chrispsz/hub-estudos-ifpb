/*
 * Service Worker do Hub de Estudos — estratégia ultra conservadora:
 *  - network-first para TUDO (o app é client-side e o dev server tem HMR,
 *    então NUNCA servimos cache sem antes tentar a rede);
 *  - cache só como fallback offline para navegações (a shell da SPA);
 *  - nunca cacheia nada que não seja a navegação principal e os ícones.
 * Assim o app é instalável como PWA sem quebrar HMR/updates.
 */
const CACHE = 'hub-estudos-ifpb-v1';
const SHELL = ['/', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
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
  // Só tratamos GETs de navegação (a shell do app). Todo o resto passa direto.
  if (req.method !== 'GET' || req.mode !== 'navigate') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Atualiza o cache da shell em background
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put('/', copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match('/').then((hit) => hit ?? caches.match(req)))
  );
});
