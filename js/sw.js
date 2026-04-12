/* ============================================================
   MEEZAN — ميزان  |  sw.js
   Service Worker — PWA Install + Offline Support
   ============================================================ */

const CACHE_NAME   = 'meezan-v2';
const STATIC_CACHE = 'meezan-static-v2';

/* Shell files that must be cached for offline use */
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/themes.css',
  '/css/phone.css',
  '/css/tablet.css',
  '/css/sidebar.css',
  '/js/i18n.js',
  '/pages/dashboard.html',
  '/pages/income.html',
  '/pages/expenses.html',
  '/pages/assets.html',
  '/pages/zakat.html',
  '/pages/settings.html',
];

/* ── INSTALL: cache shell ── */
self.addEventListener('install', event => {
  console.log('[SW] Installing Meezan service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        /* Use individual add calls so one failure doesn't break everything */
        return Promise.allSettled(
          SHELL.map(url => cache.add(url).catch(err =>
            console.warn('[SW] Failed to cache:', url, err.message)
          ))
        );
      })
      .then(() => {
        console.log('[SW] Shell cached ✓');
        return self.skipWaiting(); /* Activate immediately */
      })
  );
});

/* ── ACTIVATE: clean old caches ── */
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim()) /* Take control of all pages */
  );
});

/* ── FETCH: Network-first for API, Cache-first for assets ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Skip non-GET, cross-origin Firebase/API calls */
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('firestore.googleapis.com')) return;
  if (url.hostname.includes('firebase')) return;
  if (url.hostname.includes('aladhan.com')) return;
  if (url.hostname.includes('googleapis.com') && !url.pathname.includes('firebasejs')) return;

  /* For navigation requests (HTML pages) — network first, fallback to cache */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          /* Cache fresh copy */
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request)
          .then(cached => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  /* For static assets — cache first, fallback to network */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        return res;
      }).catch(() => {
        /* Return nothing — let browser handle gracefully */
      });
    })
  );
});
