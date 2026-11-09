/* ============================================================
   MEEZAN — ميزان  |  sw.js
   Network-first for pages, scripts, styles and data so a new
   deploy shows up the next time the app opens (and the app shows
   an "Update now" toast). Images/fonts are cache-first. Firebase
   and other websites are never cached. Works offline from cache.
   The BUILD line below is stamped by scripts/stamp-version.js on
   every Vercel deploy, which is what makes browsers fetch the new
   service worker.
   ============================================================ */

const BUILD = 'dev';
const CACHE = 'meezan-' + BUILD;
const PRECACHE = ['/', '/index.html', '/pages/dashboard.html', '/css/meezan.css', '/manifest.json', '/assets/icon-192.png', '/assets/favicon.png'];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE).then(function(cache) {
            return Promise.all(PRECACHE.map(function(u) { return cache.add(u).catch(function() {}); }));
        }).then(function() { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.filter(function(k) { return k.indexOf('meezan-') === 0 && k !== CACHE; }).map(function(k) { return caches.delete(k); }));
        }).then(function() { return self.clients.claim(); })
    );
});

function networkFirst(req) {
    return fetch(req).then(function(res) {
        if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(function(c) { c.put(req, copy); });
        }
        return res;
    }).catch(function() {
        return caches.match(req).then(function(hit) {
            return hit || caches.match('/index.html');
        });
    });
}

function cacheFirst(req) {
    return caches.match(req).then(function(hit) {
        if (hit) { return hit; }
        return fetch(req).then(function(res) {
            if (res && res.ok && res.type === 'basic') {
                const copy = res.clone();
                caches.open(CACHE).then(function(c) { c.put(req, copy); });
            }
            return res;
        });
    });
}

self.addEventListener('fetch', function(event) {
    const req = event.request;
    if (req.method !== 'GET') { return; }
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) { return; } /* Firebase, Google, fonts: straight to network */
    if (url.pathname === '/version.json' || url.pathname === '/sw.js') { return; }
    if (/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
        event.respondWith(cacheFirst(req));
        return;
    }
    event.respondWith(networkFirst(req));
});

self.addEventListener('message', function(event) {
    if (event.data === 'SKIP_WAITING') { self.skipWaiting(); }
});
