// =====================
// sw.js — Katie's Recipe Book Service Worker
// Caches the app shell so it loads instantly and works offline.
// =====================

const CACHE_NAME = 'katiescookbook-v2';

// Files that make up the app shell — cached on first install.
// The recipe data itself is fetched live from Google Apps Script each time,
// so it is NOT in this list (it changes too often to cache reliably).
const APP_SHELL = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;600&display=swap',
];

// ── Install: pre-cache the app shell ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Use individual requests so one failed asset doesn't abort everything
      return Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ─────────────────────────
self.addEventListener('fetch', event => {
  // Don't intercept the Google Apps Script API call — it must always be live.
  if (event.request.url.includes('script.google.com')) {
    return;
  }

  // For everything else: try cache first, then network, then cache whatever
  // comes back so future visits are faster.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Only cache valid, same-origin or CORS responses
        if (
          !response ||
          response.status !== 200 ||
          (response.type !== 'basic' && response.type !== 'cors')
        ) {
          return response;
        }

        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});
