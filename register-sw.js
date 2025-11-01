// This script should be loaded in index.html before the main app script.

if ('serviceWorker' in navigator) {
  // We register the service worker after the page has loaded
  // to not block critical resources.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
