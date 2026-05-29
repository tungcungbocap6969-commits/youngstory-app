const CACHE_NAME = 'xuong-sx-v19';
const CORE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CORE_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting(); // Tự động kích hoạt ngay, không cần user bấm
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  const u = new URL(url);
  if (u.origin !== self.location.origin) return false;
  if (u.pathname === '/clear.html') return false; // không cache trang reset
  return /\.(html|css|js|png|jpg|svg|json|woff2?)$/.test(u.pathname);
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Navigate requests → chỉ intercept '/' và '/index.html', còn lại để browser tự fetch
  if (event.request.mode === 'navigate') {
    const path = new URL(event.request.url).pathname;
    if (path === '/' || path === '/index.html') {
      event.respondWith(
        caches.match('/').then(cached => cached || fetch('/'))
      );
    }
    return;
  }

  // API calls (Supabase, v.v.) — không cache, luôn lấy từ network
  if (!isStaticAsset(event.request.url)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
