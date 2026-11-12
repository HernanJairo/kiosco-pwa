const CACHE_NAME = 'yapa-cache-v19';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', (event) => {
  // Activa el nuevo worker de inmediato, sin esperar a que el usuario cierre la app.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js') return;

  // Navegación (HTML): Network First — siempre intenta la red primero
  const esHTML =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
  if (esHTML) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put('/index.html', copy));
            return res;
          }
          return caches.match('/index.html').then((cached) => cached || res);
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets estáticos: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
