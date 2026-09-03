/* Hollowmere service worker.
   Strategy matters here:
     - the page itself is NETWORK-FIRST, so a freshly uploaded index.html is
       picked up on the next launch without anyone editing this file
     - icons and the manifest are CACHE-FIRST, they almost never change
     - everything falls back to cache when offline
   Because of that, CACHE below does not need bumping on every release. */
const CACHE = 'hollowmere';
const SHELL = ['./', './index.html'];
const STATIC = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.concat(STATIC)).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

function isShell(req) {
  if (req.mode === 'navigate') return true;
  const u = new URL(req.url);
  return u.pathname.endsWith('/') || u.pathname.endsWith('index.html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (isShell(req)) {
    // network first: newest build wins, cache is the offline safety net
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
        }
        return res;
      }).catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // static assets: cache first
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => new Response('', {status: 504}))
  );
});
