// Mantém o jogo funcionando sem internet depois do primeiro carregamento.
// Estratégia: rede primeiro (sempre a versão mais nova), cache como reserva.
const CACHE = 'e3-jogo-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'ntfy.sh') return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque') && !req.headers.has('range')) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || Response.error()))
  );
});
