// This script should be loaded in index.html before the main app script.

if ('serviceWorker' in navigator) {
  // Register the service worker immediately, without waiting for the 'load' event.
  // This is crucial to ensure it can intercept the very first script requests and
  // fix the MIME type error before the browser tries to execute them.
  navigator.serviceWorker
    .register('./sw.js')
    .then(registration => {
      console.log('SW registration initiated successfully:', registration);
    })
    .catch(registrationError => {
      console.error('SW registration failed:', registrationError);
    });
}