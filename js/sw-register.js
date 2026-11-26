/* Service worker registration (kept external so the CSP can forbid inline scripts). */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function () {});
}
