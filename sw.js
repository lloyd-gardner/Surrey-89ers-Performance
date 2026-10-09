// Surrey 89ers Performance Hub — Service Worker
// Network first, so pages and data are always current when online;
// the cache is only a fallback for a dropped connection.
const CACHE = '89ers-performance-v3';
const CORE = ['/index.html', '/hub.js', '/sc.css', '/sc.js', '/sc-overview.html', '/sc-sessions.html', '/sc-library.html', '/therapy.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
