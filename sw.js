/* Service worker: full offline precache. Version bump forces refresh. */
const CACHE = 'oph-assistant-v5';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css',
  'js/vendor/jspdf.umd.min.js',
  'js/crypto.js', 'js/data.js', 'js/db.js', 'js/app.js', 'js/ui.js', 'js/home.js', 'js/patient.js',
  'js/quick.js', 'js/exam.js', 'js/surgery.js', 'js/slist.js', 'js/export-svg.js', 'js/export.js',
  'js/transcribe.js', 'js/settings.js', 'js/lock.js', 'js/sw-register.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request)));
});
