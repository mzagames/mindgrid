/* MindGrid service worker: pre-cache everything, serve cache-first, refresh in background. */
const CACHE = 'mindgrid-v1.0.0';
const FILES = [
  './', 'index.html', 'play.html', 'journey.html', 'archive.html', 'stats.html', 'settings.html', 'howto.html',
  'manifest.webmanifest', 'assets/icon.svg', 'css/style.css', 'js/core.js',
  'js/puzzles/blocks.js', 'js/puzzles/pipes.js', 'js/puzzles/link.js', 'js/puzzles/crowns.js', 'js/puzzles/lights.js',
  'js/pages/home.js', 'js/pages/play.js', 'js/pages/journey.js', 'js/pages/archive.js', 'js/pages/stats.js',
  'js/pages/settings.js', 'js/pages/howto.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => {
    const net = fetch(e.request).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
