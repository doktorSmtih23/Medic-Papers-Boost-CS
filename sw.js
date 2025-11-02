const CACHE_NAME = 'medic-boost-cache-v1';
// Files that constitute the "app shell"
const urlsToCache = [
  '/',
  './index.html',
  './index.tsx',
  './manifest.json'
];

// Install the service worker and cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

// Clean up old caches on activation
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Intercept fetch requests
self.addEventListener('fetch', event => {
  // Use a "Network falling back to cache" strategy for all GET requests
  if (event.request.method !== 'GET') {
      return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      // If the network request fails (e.g., offline),
      // try to serve the response from the cache.
      return caches.match(event.request);
    })
  );
});
