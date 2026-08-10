const CACHE_NAME = 'mtctiers-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/app.js',
  '/status.html',
  '/guide.html',
  '/404.html',
  '/manifest.json',
  '/assets/mtctiers.png',
  '/assets/mtctiers_default_skin.png',
  '/assets/emerald.png',
  '/assets/emerald_kb.png',
  '/assets/dragonhide_kb.png',
  '/assets/manhunt.png',
  '/assets/diamond.png',
  '/assets/novelty_axe.png',
  '/assets/dragonhide_anchor.png',
  '/assets/void.png',
  '/data/rankings.json',
  '/data/duels.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('⚡ [Service Worker] Pre-caching static assets for offline use...');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[Service Worker] Static pre-cache note:', err.message);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests
  if (req.method !== 'GET') return;

  // Strategy 1: Static JSON files & Local Assets -> Cache First with Network Refresh
  if (url.origin === location.origin && (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/assets/'))) {
    event.respondWith(
      caches.match(req).then(cachedRes => {
        const fetchPromise = fetch(req).then(networkRes => {
          if (networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return networkRes;
        }).catch(() => null);

        return cachedRes || fetchPromise || fetch(req);
      })
    );
    return;
  }

  // Strategy 2: External REST APIs / Firestore -> Network First with Offline Cache Fallback
  event.respondWith(
    fetch(req).then(networkRes => {
      if (networkRes && networkRes.status === 200) {
        const resClone = networkRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
      }
      return networkRes;
    }).catch(async () => {
      const cachedRes = await caches.match(req);
      if (cachedRes) return cachedRes;

      // Fallback for HTML navigation requests
      if (req.mode === 'navigate') {
        const offlinePage = await caches.match('/index.html');
        if (offlinePage) return offlinePage;
      }

      return new Response(JSON.stringify({ offline: true, error: "Network offline" }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    })
  );
});
