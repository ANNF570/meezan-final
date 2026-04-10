/* ============================================================
   MEEZAN — Service Worker (sw.js)
   PWA install support — safe no-cache version
   Firebase handles its own caching; we don't interfere.
   ============================================================ */

const CACHE_NAME = 'meezan-v1';

// Core shell files to cache for offline load
const SHELL_FILES = [
  '/index.html',
  '/css/main.css',
  '/css/themes.css',
  '/css/sidebar.css',
  '/css/phone.css',
  '/css/tablet.css',
  '/assets/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', event => {
  console.log('[SW] Installing Meezan service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_FILES).catch(err => {
        // Don't fail install if some files are missing
        console.warn('[SW] Cache addAll partial failure:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating Meezan service worker...');
  // Remove old caches
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Firebase, APIs, or external resources
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('google') ||
    url.hostname.includes('aladhan') ||
    url.hostname.includes('gstatic') ||
    url.protocol === 'chrome-extension:'
  ) {
    return; // Let browser handle — no cache
  }

  // For navigation requests: network first, fall back to cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html')
      )
    );
    return;
  }

  // For static assets: cache first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Cache new static files on the fly
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
