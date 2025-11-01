if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        console.log('Service Worker registrado con éxito:', registration);
      })
      .catch(registrationError => {
        console.error('Fallo en el registro del Service Worker:', registrationError);
      });
  });
}
