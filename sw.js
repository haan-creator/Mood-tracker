// Bumping this name is what retires the previous cache on activate.
const CACHE = 'moodsky-v2';

// Only assets that change rarely belong here. index.html deliberately
// does not: it is the thing that changes on every release.
const ASSETS = [
  './manifest.json',
  './DMSans-Variable.woff2',
  './Syne-Variable.woff2',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const isPage = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isPage) {
    // Network first. The previous version served the page from cache
    // unconditionally, so a published update could never reach anyone who
    // had already opened the app — they stayed pinned to whatever build
    // they first loaded. Cache is the offline fallback only.
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Fonts and icons are safe from cache, and are filled in on first use.
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
    )
  );
});
