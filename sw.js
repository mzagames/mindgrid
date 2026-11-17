/* MindGrid is no longer played on the web (it's an Android app on Google Play).
   This worker replaces the old offline cache: it deletes every cache, unregisters itself
   and reloads open pages so they pick up the redirect to the game's page. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const wins = await self.clients.matchAll({ type: 'window' });
    wins.forEach((c) => { try { c.navigate(c.url); } catch (err) { /* ignore */ } });
  })());
});
