/* ============================================================
   MEEZAN — ميزان  |  sw.js
   Service Worker v3 — correct paths, robust caching
   ============================================================ */

const CACHE_NAME   = 'meezan-v3';
const STATIC_CACHE = 'meezan-static-v3';

/* Only cache files we KNOW exist — missing files break install */
const SHELL = [
  '/index.html',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/favicon.png',
  '/css/main.css',
  '/css/themes.css',
  '/css/phone.css',
  '/css/tablet.css',
  '/css/sidebar.css',
  '/js/i18n.js',
  '/pages/dashboard.html',
];

/* ── INSTALL ── */
self.addEventListener('install', event => {
  console.log('[SW] Installing v3...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      Promise.allSettled(
        SHELL.map(url =>
          cache.add(url).catch(e =>
            console.warn('[SW] Could not cache:', url, e.message)
          )
        )
      )
    ).then(() => {
      console.log('[SW] Shell cached ✓');
      return self.skipWaiting();
    })
  );
});

/* ── ACTIVATE: delete old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Skip non-GET */
  if (event.request.method !== 'GET') return;

  /* Skip Firebase, Firestore, external APIs */
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('aladhan.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    (url.hostname.includes('googleapis.com') && !url.hostname.includes('gstatic'))
  ) return;

  /* Navigation (HTML) — network first, fallback to cache */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return res;
        })
        .catch(() =>
          caches.match(event.request).then(c => c || caches.match('/index.html'))
        )
    );
    return;
  }

  /* Static assets — cache first, then network */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return res;
      }).catch(() => { /* network failed, nothing cached — browser handles */ });
    })
  );
});
