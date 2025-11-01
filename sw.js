// A simple, aggressive service worker to fix MIME types for TSX files.

self.addEventListener('install', (event) => {
  // Activate immediately
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Take control of all clients as soon as the SW activates
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if it's a request for a TS/TSX file from the same origin
  if (url.origin === self.origin && (url.pathname.endsWith('.ts') || url.pathname.endsWith('.tsx'))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response.ok) {
            return response;
          }
          
          // Clone the response to be able to read headers and body, then set the correct Content-Type
          const newHeaders = new Headers(response.headers);
          newHeaders.set('Content-Type', 'application/javascript; charset=utf-8');
          
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
          });
        })
        .catch(error => {
          console.error(`Service Worker fetch error for ${event.request.url}:`, error);
          // Provide a fallback response if the fetch fails
          return new Response(`/* Service Worker fetch failed */`, {
            status: 500,
            headers: { 'Content-Type': 'application/javascript; charset=utf-8' }
          });
        })
    );
  }
});
