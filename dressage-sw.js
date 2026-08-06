/* Service worker for the Second Level Test 1 PWA.
   Registered at the site root so it can control /dressage-test (Vercel is
   configured with trailingSlash:false, so the app has no directory URL).
   It only handles its own assets — every other request falls through to
   the network untouched. */
const CACHE = 'sl-test1-v1';
const ASSETS = [
  '/dressage-test',
  '/dressage-test/app.css',
  '/dressage-test/app.js',
  '/dressage-test/manifest.json',
  '/dressage-test/icon-192.png',
  '/dressage-test/icon-512.png',
  '/dressage-test/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/dressage-test')) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('/dressage-test'));
    })
  );
});
