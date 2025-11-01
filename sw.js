const CACHE_NAME = 'medic-papers-boost-cs-cache-v2'; // New version
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // Main external dependencies for offline functionality
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.min.mjs',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use addAll with a catch to prevent a single failed resource from failing the entire install
        return cache.addAll(URLS_TO_CACHE).catch(err => {
            console.error('Failed to cache one or more critical resources during install:', err);
        });
      })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // CRITICAL FIX: Intercept TS/TSX files and serve them with the correct MIME type.
  // This is necessary because static hosts like GitHub Pages don't know the correct Content-Type.
  if (url.pathname.endsWith('.ts') || url.pathname.endsWith('.tsx')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (!response.ok) {
          // If the file is not found (404), etc., pass the error response through.
          return response;
        }
        // Create a new Response object with the same body but corrected headers.
        const headers = new Headers(response.headers);
        headers.set('Content-Type', 'application/javascript');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers
        });
      })
    );
    return; // End here for TS/TSX files.
  }

  // For all other requests, use a standard cache-then-network strategy.
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Return from cache if found.
      if (cachedResponse) {
        return cachedResponse;
      }
      // Otherwise, fetch from the network.
      return fetch(event.request).then(networkResponse => {
        // Don't cache unsuccessful responses or opaque responses
        if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
          return networkResponse;
        }

        // Clone the response to store it in the cache.
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          if (event.request.method === 'GET') {
            cache.put(event.request, responseToCache);
          }
        });
        return networkResponse;
      });
    })
  );
});


self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});