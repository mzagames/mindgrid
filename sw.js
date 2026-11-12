/* MindGrid service worker: network-first (always fresh when online), cache fallback (works offline). */
const CACHE = 'mindgrid-v1.6.0';
const FILES = [
  './', 'index.html', 'daily.html', 'play.html', 'journey.html', 'archive.html', 'stats.html', 'settings.html', 'howto.html', 'privacy.html',
  'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/mza-games-logo.png', 'css/style.css', 'css/tutorial.css', 'js/core.js', 'js/tutorial.js',
  'js/puzzles/blocks.js', 'js/puzzles/pipes.js', 'js/puzzles/link.js', 'js/puzzles/crowns.js', 'js/puzzles/lights.js', 'js/puzzles/balance.js', 'js/levels.js', 'js/billing.js', 'js/ads.js', 'js/feedback.js',
  'js/pages/home.js', 'js/pages/daily.js', 'js/pages/play.js', 'js/pages/journey.js', 'js/pages/archive.js', 'js/pages/stats.js',
  'js/pages/settings.js', 'js/pages/howto.js'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the browser HTTP cache so a new version never pre-caches stale files
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.origin + url.pathname; // play.html?type=x and play.html share one cache entry
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then((hit) => hit || caches.match(e.request, { ignoreSearch: true })))
  );
});
