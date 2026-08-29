const CACHE_NAME = 'mtctiers-pwa-v20260829_1';
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
  '/assets/void.png'
];

function isDataJsonRequest(url) {
  return url.origin === location.origin && url.pathname.startsWith('/data/');
}

function isCacheableStatic(url) {
  return url.origin === location.origin &&
    (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/assets/')) &&
    !isDataJsonRequest(url);
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('⚡ [Service Worker] Fresh cache initialized');
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('💥 [Service Worker] Destroying old cache key:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Published snapshots and live APIs: network only. Never cache-first
  // empty/error bodies that would stick the site in Offline Mode.
  if (isDataJsonRequest(url) || url.hostname.includes('googleapis.com') || url.hostname.includes('railway.app')) {
    event.respondWith(
      fetch(req).catch(async () => {
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
    return;
  }

  if (isCacheableStatic(url)) {
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
        const byPath = await caches.match(url.pathname);
        if (byPath) return byPath;
        throw new Error('Network offline');
      })
    );
    return;
  }

  event.respondWith(
    fetch(req).then(networkRes => {
      if (networkRes && networkRes.status === 200 && url.origin === location.origin) {
        const resClone = networkRes.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
      }
      return networkRes;
    }).catch(async () => {
      const cachedRes = await caches.match(req);
      if (cachedRes) return cachedRes;

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
